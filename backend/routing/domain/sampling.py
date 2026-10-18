"""Place checkpoints every N miles along a route and estimate when the truck
reaches each one."""

from __future__ import annotations

from collections.abc import Sequence

from .geo import cumulative_miles, lerp, point_at_mile
from .models import Coord, SamplePoint


def sample_route(
    coords: Sequence[Coord], vertex_times: Sequence[float], interval_mi: float
) -> list[SamplePoint]:
    """Checkpoints at 0, N, 2N, ... miles, plus the destination.

    The ETA at each checkpoint is interpolated from the provider's cumulative
    travel time per vertex, so slow urban stretches are reflected.
    """
    if interval_mi <= 0:
        raise ValueError("interval_mi must be positive")
    if len(coords) != len(vertex_times):
        raise ValueError("coords and vertex_times must have the same length")

    miles = cumulative_miles(coords)
    total = miles[-1]

    targets: list[float] = []
    m = 0.0
    while m < total:
        targets.append(m)
        m += interval_mi
    targets.append(total)

    points: list[SamplePoint] = []
    for target in targets:
        (lon, lat), i, t = point_at_mile(coords, miles, target)
        if i >= len(vertex_times) - 1:
            eta = vertex_times[-1]
        else:
            eta = lerp(vertex_times[i], vertex_times[i + 1], t)
        points.append(SamplePoint(mile=target, lon=lon, lat=lat, eta_offset_s=eta))
    return points
