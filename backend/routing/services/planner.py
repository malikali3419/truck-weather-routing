"""Plan a trip: routes → checkpoints → weather at ETA → risk → recommendation."""

from __future__ import annotations

import string
from dataclasses import dataclass
from datetime import datetime

from django.core.cache import cache

from routing.domain import constants as c
from routing.domain.geo import cumulative_miles, encode_polyline, lerp, point_at_mile, simplify
from routing.domain.models import Checkpoint, Coord, RawRoute, RouteScore
from routing.domain.recommend import Candidate, Recommendation, recommend
from routing.domain.risk import classify
from routing.domain.sampling import sample_route
from routing.domain.scenario import Storm
from routing.domain.scoring import score_route
from routing.providers.alternatives import generate_routes
from routing.providers.base import RoutingProvider, WeatherProvider
from routing.providers.open_meteo import snap

WEATHER_SNAP_DEG = 0.1  # ~11 km; finer than the 10-mile checkpoint spacing
SIMPLIFY_TOLERANCE_DEG = 0.0003  # ~30 m
ROUTE_CACHE_TTL_S = 6 * 3600
STORM_POSITION = 0.55  # share of the fastest route where a simulated storm peaks


@dataclass
class TripRequest:
    origin: Coord
    destination: Coord
    departure: datetime
    load_lb: float
    interval_mi: int
    simulate_storm: bool = False


@dataclass
class PlannedRoute:
    id: str
    raw: RawRoute
    checkpoints: list[Checkpoint]
    score: RouteScore


def gross_weight_tonnes(load_lb: float) -> float:
    return (load_lb + c.TRUCK_TARE_LB) / c.LB_PER_TONNE


def plan_trip(req: TripRequest, routing: RoutingProvider, weather: WeatherProvider) -> dict:
    raws, source = _routes(req, routing)
    depart_ts = req.departure.timestamp()
    storm = _storm_on(raws[0], depart_ts) if req.simulate_storm else None

    samples = [sample_route(r.coords, r.vertex_times, req.interval_mi) for r in raws]
    lookup = [[snap(p.lat, p.lon, WEATHER_SNAP_DEG) for p in s] for s in samples]
    flat = [pt for pts in lookup for pt in pts]
    series = dict(zip(flat, weather.hourly(flat)))

    planned: list[PlannedRoute] = []
    for idx, (raw, route_samples, route_lookup) in enumerate(zip(raws, samples, lookup)):
        checkpoints = []
        for s, key in zip(route_samples, route_lookup):
            eta = depart_ts + s.eta_offset_s
            wx = series[key].at(eta)
            if storm:
                wx = storm.apply(wx, s.lat, s.lon, eta)
            checkpoints.append(
                Checkpoint(
                    mile=s.mile,
                    lon=s.lon,
                    lat=s.lat,
                    eta_unix=int(eta),
                    weather=wx,
                    risk=classify(wx, req.load_lb),
                )
            )
        score = score_route([cp.mile for cp in checkpoints], [cp.risk.level for cp in checkpoints])
        planned.append(PlannedRoute(string.ascii_uppercase[idx], raw, checkpoints, score))

    rec = recommend([Candidate(p.id, p.score, p.raw.duration_s) for p in planned])
    return {
        **_serialize(planned, rec, depart_ts, req, storm),
        "routing_source": source,
        "weather_source": getattr(weather, "source", "open-meteo"),
    }


def _routes(req: TripRequest, routing: RoutingProvider) -> tuple[list[RawRoute], str]:
    """Routes for the trip, cached so re-plans (new interval, new departure,
    storm toggle) don't call the routing API again."""
    weight_t = gross_weight_tonnes(req.load_lb)
    key = "routes:{:.4f},{:.4f}:{:.4f},{:.4f}:{:.0f}".format(
        *req.origin, *req.destination, weight_t
    )
    cached = cache.get(key)
    if cached:
        return cached
    raws = generate_routes(routing, req.origin, req.destination, weight_t)
    source = getattr(routing, "source", "openrouteservice")
    cache.set(key, (raws, source), ROUTE_CACHE_TTL_S)
    return raws, source


def _storm_on(route: RawRoute, depart_ts: float) -> Storm:
    """A storm that peaks on `route` just as the truck gets there."""
    miles = cumulative_miles(route.coords)
    (lon, lat), i, t = point_at_mile(route.coords, miles, miles[-1] * STORM_POSITION)
    j = min(i + 1, len(route.vertex_times) - 1)
    eta = depart_ts + lerp(route.vertex_times[i], route.vertex_times[j], t)
    return Storm(lat=round(lat, 4), lon=round(lon, 4), peak_unix=int(eta))


def _serialize(
    planned: list[PlannedRoute],
    rec: Recommendation,
    depart_ts: float,
    req: TripRequest,
    storm: Storm | None,
) -> dict:
    fastest = min(p.raw.duration_s for p in planned)
    return {
        "departure_unix": int(depart_ts),
        "load_weight_lb": req.load_lb,
        "sample_interval_mi": req.interval_mi,
        "scenario": storm.to_dict() if storm else None,
        "routes": [_route_dict(p, depart_ts, fastest) for p in planned],
        "recommendation": {
            "route_id": rec.route_id,
            "ranking": rec.ranking,
            "reasons": rec.reasons,
            "warning": rec.warning,
        },
    }


def _route_dict(p: PlannedRoute, depart_ts: float, fastest_s: float) -> dict:
    keep = simplify(p.raw.coords, SIMPLIFY_TOLERANCE_DEG)
    coords = [p.raw.coords[i] for i in keep]
    times = [round(p.raw.vertex_times[i]) for i in keep]
    s = p.score
    return {
        "id": p.id,
        "geometry": encode_polyline(coords),
        # Seconds after departure at each vertex of `geometry`.
        "vertex_offsets_s": times,
        "distance_mi": round(p.raw.distance_m / c.METERS_PER_MILE, 1),
        "duration_s": round(p.raw.duration_s),
        "extra_duration_s": round(p.raw.duration_s - fastest_s),
        "arrival_unix": int(depart_ts + p.raw.duration_s),
        "summary": {
            "miles_by_level": {lvl.name: round(m, 1) for lvl, m in s.miles_by_level.items()},
            "avg_risk": round(s.avg_risk, 2),
            "max_level": s.max_level.name,
            "has_no_travel": s.has_no_travel,
            "beyond_forecast": any(cp.weather.beyond_forecast for cp in p.checkpoints),
        },
        "segments": [
            {
                "from_mi": round(seg.from_mile, 2),
                "to_mi": round(seg.to_mile, 2),
                "level": seg.level.name,
            }
            for seg in s.segments
        ],
        "checkpoints": [_checkpoint_dict(cp) for cp in p.checkpoints],
    }


def _checkpoint_dict(cp: Checkpoint) -> dict:
    w, r = cp.weather, cp.risk
    return {
        "mile": round(cp.mile, 1),
        "lon": round(cp.lon, 5),
        "lat": round(cp.lat, 5),
        "eta_unix": cp.eta_unix,
        "weather": {
            "wind_mph": w.wind_mph,
            "gust_mph": w.gust_mph,
            "rain_in_hr": w.rain_in_hr,
            "snow_in_hr": w.snow_in_hr,
            "temp_f": w.temp_f,
            "weather_code": w.weather_code,
            "beyond_forecast": w.beyond_forecast,
        },
        "level": r.level.name,
        "factors": {
            "wind": r.wind.name,
            "rain": r.rain.name,
            "snow": r.snow.name,
            "load": r.load.name,
        },
        "reasons": list(r.reasons),
    }
