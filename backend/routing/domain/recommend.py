"""Pick the best route.

Priority, from the brief:
  1. fewest Severe miles
  2. fewest High miles
  3. lowest average risk
  4. shortest travel time
Routes with any No Travel miles are never recommended. Differences smaller
than the tolerances in `constants` are treated as ties, so 0.2 severe miles
cannot outweigh hours of extra driving.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from .constants import AVG_RISK_TOLERANCE, MILES_TOLERANCE
from .models import RouteScore


@dataclass(frozen=True)
class Candidate:
    id: str
    score: RouteScore
    duration_s: float


@dataclass(frozen=True)
class Recommendation:
    route_id: str | None
    ranking: list[str]
    reasons: list[str]
    warning: str | None


def _key(c: Candidate) -> tuple[int, int, int, float]:
    return (
        round(c.score.severe_miles / MILES_TOLERANCE),
        round(c.score.high_miles / MILES_TOLERANCE),
        round(c.score.avg_risk / AVG_RISK_TOLERANCE),
        c.duration_s,
    )


def _fmt_duration(seconds: float) -> str:
    minutes = round(seconds / 60)
    h, m = divmod(minutes, 60)
    return f"{h}h {m:02d}m" if h else f"{m} min"


def _why_better(win: Candidate, other: Candidate) -> str:
    wk, ok = _key(win), _key(other)
    w, o = win.score, other.score
    if wk[0] != ok[0]:
        return (
            f"Fewer severe-risk miles than Route {other.id} "
            f"({w.severe_miles:.0f} vs {o.severe_miles:.0f} mi)"
        )
    if wk[1] != ok[1]:
        return (
            f"Fewer high-risk miles than Route {other.id} "
            f"({w.high_miles:.0f} vs {o.high_miles:.0f} mi)"
        )
    if wk[2] != ok[2]:
        return f"Lower average risk than Route {other.id} ({w.avg_risk:.2f} vs {o.avg_risk:.2f})"
    if win.duration_s < other.duration_s:
        return (
            f"Same weather risk as Route {other.id}, "
            f"{_fmt_duration(other.duration_s - win.duration_s)} faster"
        )
    return f"Same weather risk and travel time as Route {other.id}"


def recommend(candidates: Sequence[Candidate]) -> Recommendation:
    safe = sorted((c for c in candidates if not c.score.has_no_travel), key=_key)
    unsafe = sorted(
        (c for c in candidates if c.score.has_no_travel),
        key=lambda c: (round(c.score.no_travel_miles / MILES_TOLERANCE), *_key(c)),
    )
    ranking = [c.id for c in safe + unsafe]

    if not safe:
        return Recommendation(
            route_id=None,
            ranking=ranking,
            reasons=[],
            warning=(
                "Every route crosses No Travel conditions at this departure "
                "time. Consider delaying departure."
            ),
        )

    win = safe[0]
    reasons = [_why_better(win, other) for other in safe[1:]]
    reasons += [f"Route {c.id} crosses No Travel conditions" for c in unsafe]

    fastest = min(candidates, key=lambda c: c.duration_s)
    if fastest.id != win.id:
        reasons.append(
            f"{_fmt_duration(win.duration_s - fastest.duration_s)} slower than "
            f"Route {fastest.id}, accepted for lower weather risk"
        )

    return Recommendation(route_id=win.id, ranking=ranking, reasons=reasons, warning=None)
