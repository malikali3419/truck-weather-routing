from routing.domain.models import RiskLevel as R
from routing.domain.models import RouteScore
from routing.domain.recommend import Candidate, recommend


def score(severe=0.0, high=0.0, avg=0.0, no_travel=0.0) -> RouteScore:
    miles = {lvl: 0.0 for lvl in R}
    miles[R.SEVERE], miles[R.HIGH], miles[R.NO_TRAVEL] = severe, high, no_travel
    max_level = R.NO_TRAVEL if no_travel else R.SEVERE if severe else R.HIGH if high else R.LOW
    return RouteScore(miles_by_level=miles, avg_risk=avg, max_level=max_level)


HOUR = 3600


def test_fewest_severe_miles_wins_over_speed():
    rec = recommend(
        [
            Candidate("A", score(severe=20), 10 * HOUR),
            Candidate("B", score(severe=0, high=50), 12 * HOUR),
        ]
    )
    assert rec.route_id == "B"
    assert rec.reasons[0].startswith("Fewer severe-risk miles than Route A")
    assert "slower than Route A" in rec.reasons[-1]


def test_high_miles_break_severe_tie():
    rec = recommend(
        [
            Candidate("A", score(severe=5, high=30), 10 * HOUR),
            Candidate("B", score(severe=5, high=10), 11 * HOUR),
        ]
    )
    assert rec.route_id == "B"


def test_average_risk_breaks_high_tie():
    rec = recommend(
        [
            Candidate("A", score(high=10, avg=0.9), 10 * HOUR),
            Candidate("B", score(high=10, avg=0.4), 11 * HOUR),
        ]
    )
    assert rec.route_id == "B"


def test_duration_breaks_full_tie():
    rec = recommend(
        [
            Candidate("A", score(avg=0.2), 11 * HOUR),
            Candidate("B", score(avg=0.2), 10 * HOUR),
        ]
    )
    assert rec.route_id == "B"
    assert rec.ranking == ["B", "A"]


def test_tiny_differences_are_ties():
    # 0.3 severe miles and 0.02 avg risk are below tolerance → speed decides.
    rec = recommend(
        [
            Candidate("A", score(severe=0.3, avg=0.52), 10 * HOUR),
            Candidate("B", score(severe=0.0, avg=0.50), 13 * HOUR),
        ]
    )
    assert rec.route_id == "A"


def test_no_travel_routes_are_never_recommended():
    rec = recommend(
        [
            Candidate("A", score(no_travel=5), 8 * HOUR),
            Candidate("B", score(severe=40), 12 * HOUR),
        ]
    )
    assert rec.route_id == "B"
    assert rec.ranking == ["B", "A"]
    assert "Route A crosses No Travel conditions" in rec.reasons


def test_all_routes_no_travel_gives_warning():
    rec = recommend(
        [
            Candidate("A", score(no_travel=5), 8 * HOUR),
            Candidate("B", score(no_travel=1), 9 * HOUR),
        ]
    )
    assert rec.route_id is None
    assert rec.warning
    assert rec.ranking == ["B", "A"]
