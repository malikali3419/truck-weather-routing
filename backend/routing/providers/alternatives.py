"""Always return three distinct route options.

ORS only computes alternative routes for trips under 100 km. For longer
trips we route through "via" points pushed sideways from the middle of the
main route, then keep the candidates that are genuinely different and not
absurdly slow.
"""

from __future__ import annotations

from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor

from routing.domain.geo import bearing_deg, cumulative_miles, destination_point, haversine_m
from routing.domain.models import Coord, RawRoute

from .base import ProviderError, RoutingProvider

TARGET_ROUTES = 3
NATIVE_ALTERNATIVES_MAX_M = 80_000
MAX_DURATION_RATIO = 1.6
MAX_OVERLAP = 0.8
# A via point that lands on a side road makes the route drive out and back
# the same way. Reject candidates that retrace more than this.
MAX_BACKTRACK_M = 10_000
MAX_BACKTRACK_SHARE = 0.03
# (fraction along the route, sideways offset as a share of the straight-line distance)
VIA_ROUNDS = (
    ((0.5, 0.15), (0.5, 0.30)),
    ((0.35, 0.22), (0.65, 0.22), (0.5, 0.45)),
)
_CELL_DEG = 0.02  # ~2 km grid used to measure how much two routes overlap


def generate_routes(
    provider: RoutingProvider, origin: Coord, destination: Coord, gross_weight_t: float
) -> list[RawRoute]:
    straight_m = haversine_m(origin, destination)

    if straight_m < NATIVE_ALTERNATIVES_MAX_M:
        routes = provider.route(
            [origin, destination], gross_weight_t, alternatives=TARGET_ROUTES - 1
        )
    else:
        routes = provider.route([origin, destination], gross_weight_t)
    if not routes:
        raise ProviderError("No truck route could be found", status=422)

    selected = _distinct(routes)
    main = selected[0]
    for round_ in VIA_ROUNDS:
        if len(selected) >= TARGET_ROUTES:
            break
        vias = _via_points(main, origin, destination, straight_m, round_)
        candidates = _route_many(provider, origin, destination, vias, gross_weight_t)
        candidates.sort(key=lambda r: r.duration_s)
        for cand in candidates:
            if len(selected) >= TARGET_ROUTES:
                break
            if cand.duration_s > main.duration_s * MAX_DURATION_RATIO:
                continue
            if all(overlap(cand, s) < MAX_OVERLAP for s in selected):
                selected.append(cand)

    return sorted(selected[:TARGET_ROUTES], key=lambda r: r.duration_s)


def _distinct(routes: Sequence[RawRoute]) -> list[RawRoute]:
    out: list[RawRoute] = []
    for r in routes:
        if all(overlap(r, s) < MAX_OVERLAP for s in out):
            out.append(r)
    return out


def _via_points(
    main: RawRoute,
    origin: Coord,
    destination: Coord,
    straight_m: float,
    specs: Sequence[tuple[float, float]],
) -> list[Coord]:
    miles = cumulative_miles(main.coords)
    brg = bearing_deg(origin, destination)
    vias: list[Coord] = []
    for fraction, offset_share in specs:
        target = miles[-1] * fraction
        idx = next(i for i, m in enumerate(miles) if m >= target)
        anchor = main.coords[idx]
        offset_m = max(15_000.0, min(straight_m * offset_share, 250_000.0))
        for side in (-90, 90):
            vias.append(destination_point(anchor, (brg + side) % 360, offset_m))
    return vias


def _route_many(
    provider: RoutingProvider,
    origin: Coord,
    destination: Coord,
    vias: list[Coord],
    gross_weight_t: float,
) -> list[RawRoute]:
    def one(via: Coord) -> RawRoute | None:
        try:
            routes = provider.route([origin, via, destination], gross_weight_t)
        except ProviderError:
            return None
        if not routes or backtracks(routes[0], via):
            return None
        return routes[0]

    # A few at a time: the free routing APIs throttle bursts of parallel calls.
    with ThreadPoolExecutor(max_workers=min(3, len(vias))) as pool:
        return [r for r in pool.map(one, vias) if r is not None]


def backtracks(route: RawRoute, via: Coord) -> bool:
    """True if the route retraces itself around the via point (a dead-end detour)."""
    split = min(range(len(route.coords)), key=lambda i: haversine_m(route.coords[i], via))
    before, after = route.coords[: split + 1], route.coords[split:]
    shared, _ = _shared_length(after, before)
    return shared > max(MAX_BACKTRACK_M, route.distance_m * MAX_BACKTRACK_SHARE)


def _cells(coords: Sequence[Coord]) -> set[tuple[int, int]]:
    return {(int(lon / _CELL_DEG), int(lat / _CELL_DEG)) for lon, lat in coords}


def _shared_length(a: Sequence[Coord], b: Sequence[Coord]) -> tuple[float, float]:
    """Metres of line `a` that run along line `b`, and the total length of `a`."""
    cells_b = _cells(b)
    shared = total = 0.0
    for p, q in zip(a, a[1:]):
        d = haversine_m(p, q)
        total += d
        cx, cy = int(p[0] / _CELL_DEG), int(p[1] / _CELL_DEG)
        if any((cx + dx, cy + dy) in cells_b for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            shared += d
    return shared, total


def overlap(a: RawRoute, b: RawRoute) -> float:
    """Share of route `a`'s length that runs along route `b` (0..1)."""
    shared, total = _shared_length(a.coords, b.coords)
    return shared / total if total else 1.0
