"""OSRM public server: fallback routing when OpenRouteService is unavailable.

OSRM has no truck profile, so car travel times are stretched by
TRUCK_TIME_FACTOR to approximate slower truck speeds. The API response tells
the user when this fallback was used.
"""

from __future__ import annotations

import httpx

from routing.domain.geo import cumulative_miles
from routing.domain.models import Coord, RawRoute

from .base import ProviderError

TRUCK_TIME_FACTOR = 1.15


class OsrmClient:
    def __init__(self, base_url: str = "https://router.project-osrm.org", timeout: float = 15.0):
        self._http = httpx.Client(base_url=base_url, timeout=timeout)

    def route(
        self,
        coords: list[Coord],
        gross_weight_t: float,
        alternatives: int = 0,
    ) -> list[RawRoute]:
        path = "/route/v1/driving/" + ";".join(f"{lon:.6f},{lat:.6f}" for lon, lat in coords)
        params = {
            "alternatives": str(alternatives) if alternatives else "false",
            "overview": "full",
            "geometries": "geojson",
            "annotations": "duration",
        }
        try:
            res = self._http.get(path, params=params)
            data = res.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ProviderError(f"Fallback routing service unavailable: {exc}") from exc
        if data.get("code") != "Ok":
            if data.get("code") in ("NoRoute", "NoSegment"):
                raise ProviderError("No route could be found between these places", status=422)
            raise ProviderError(data.get("message") or "Fallback routing service error")
        return [_parse(r) for r in data.get("routes", [])]


def _parse(route: dict) -> RawRoute:
    coords: list[Coord] = [(c[0], c[1]) for c in route["geometry"]["coordinates"]]
    step_times = [
        d * TRUCK_TIME_FACTOR for leg in route["legs"] for d in leg["annotation"]["duration"]
    ]
    duration = route["duration"] * TRUCK_TIME_FACTOR
    if len(step_times) == len(coords) - 1:
        times = [0.0]
        for d in step_times:
            times.append(times[-1] + d)
    else:
        # Annotation and geometry disagree: spread time by distance instead.
        miles = cumulative_miles(coords)
        times = [duration * m / miles[-1] if miles[-1] else 0.0 for m in miles]
    return RawRoute(
        coords=coords,
        distance_m=route["distance"],
        duration_s=duration,
        vertex_times=times,
    )
