"""Weather heatmap for the trip corridor, hours 0–48 after departure.

The grid is fetched once and returned as compact per-hour arrays, so the
frontend slider never has to call the server again.
"""

from __future__ import annotations

import math
from collections.abc import Sequence

from routing.domain.geo import cumulative_miles, point_at_mile
from routing.domain.models import Coord
from routing.domain.risk import classify
from routing.domain.scenario import Storm
from routing.providers.base import WeatherProvider

HOURS = 48
CORRIDOR_RADIUS_MI = 40
MAX_POINTS = 220  # keeps one plan well inside the free 5,000-locations-per-hour weather quota
GRID_STEPS_DEG = (0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1.0)
MILES_PER_DEG_LAT = 69.0


def corridor_grid(routes: Sequence[Sequence[Coord]]) -> tuple[list[tuple[float, float]], float]:
    """Grid points (lat, lon) within CORRIDOR_RADIUS_MI of any route.

    Picks the finest grid step that stays under MAX_POINTS.
    """
    for step in GRID_STEPS_DEG:
        points = _grid_for_step(routes, step)
        if len(points) <= MAX_POINTS:
            return points, step
    return points[:MAX_POINTS], step


def _grid_for_step(routes: Sequence[Sequence[Coord]], step: float) -> list[tuple[float, float]]:
    cells: set[tuple[int, int]] = set()
    radius_lat = CORRIDOR_RADIUS_MI / MILES_PER_DEG_LAT
    for coords in routes:
        miles = cumulative_miles(coords)
        spacing = max(step * MILES_PER_DEG_LAT / 2, 5.0)
        m = 0.0
        while m <= miles[-1]:
            (lon, lat), _, _ = point_at_mile(coords, miles, m)
            radius_lon = radius_lat / max(math.cos(math.radians(lat)), 0.2)
            for iy in _grid_range(lat, radius_lat, step):
                for ix in _grid_range(lon, radius_lon, step):
                    dy = (iy * step - lat) / radius_lat
                    dx = (ix * step - lon) / radius_lon
                    if dx * dx + dy * dy <= 1:
                        cells.add((iy, ix))
            m += spacing
    return sorted((round(iy * step, 4), round(ix * step, 4)) for iy, ix in cells)


def _grid_range(center: float, radius: float, step: float) -> range:
    return range(math.floor((center - radius) / step), math.ceil((center + radius) / step) + 1)


def build_heatmap(
    routes: Sequence[Sequence[Coord]],
    departure_ts: float,
    load_lb: float,
    weather: WeatherProvider,
    storm: Storm | None = None,
) -> dict:
    points, step = corridor_grid(routes)
    series = weather.hourly(points)
    start = int(departure_ts // 3600) * 3600
    times = [start + h * 3600 for h in range(HOURS + 1)]

    risk, wind, rain, snow = [], [], [], []
    for t in times:
        frame = [s.at(t) for s in series]
        if storm:
            frame = [storm.apply(w, lat, lon, t) for w, (lat, lon) in zip(frame, points)]
        risk.append([int(classify(w, load_lb).level) for w in frame])
        wind.append([round(w.wind_mph) for w in frame])
        rain.append([round(w.rain_in_hr, 2) for w in frame])
        snow.append([round(w.snow_in_hr, 2) for w in frame])

    return {
        "points": [[lat, lon] for lat, lon in points],
        "grid_step_deg": step,
        "times_unix": times,
        "layers": {"risk": risk, "wind": wind, "rain": rain, "snow": snow},
    }
