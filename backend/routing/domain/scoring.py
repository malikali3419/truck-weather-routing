"""Turn per-checkpoint risk into per-route totals."""

from __future__ import annotations

from collections.abc import Sequence

from .models import RiskLevel, RouteScore, Segment


def score_route(miles: Sequence[float], levels: Sequence[RiskLevel]) -> RouteScore:
    """Score a route from its checkpoints (mile marker and risk level each).

    Each stretch between two checkpoints takes the worse of its two end
    levels — we only know the weather at the checkpoints, so we assume the
    worse one applies to the whole stretch.
    """
    if len(miles) != len(levels) or not miles:
        raise ValueError("need one level per checkpoint")

    miles_by_level = {level: 0.0 for level in RiskLevel}
    segments: list[Segment] = []
    weighted = 0.0

    for i in range(len(miles) - 1):
        length = miles[i + 1] - miles[i]
        level = max(levels[i], levels[i + 1])
        miles_by_level[level] += length
        weighted += length * level
        segments.append(Segment(miles[i], miles[i + 1], level))

    total = miles[-1] - miles[0]
    avg = weighted / total if total > 0 else float(levels[0])
    return RouteScore(
        miles_by_level=miles_by_level,
        avg_risk=avg,
        max_level=max(levels),
        segments=segments,
    )
