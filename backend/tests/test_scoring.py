import pytest

from routing.domain.models import RiskLevel as R
from routing.domain.scoring import score_route


def test_each_stretch_takes_worse_end():
    score = score_route([0, 10, 20, 30], [R.LOW, R.HIGH, R.LOW, R.LOW])
    assert score.miles_by_level[R.HIGH] == 20  # both stretches touching the HIGH checkpoint
    assert score.miles_by_level[R.LOW] == 10
    assert [s.level for s in score.segments] == [R.HIGH, R.HIGH, R.LOW]


def test_average_is_distance_weighted():
    # 10 mi at SEVERE (3) and 30 mi at LOW (0) → 30 / 40 = 0.75
    score = score_route([0, 10, 40], [R.SEVERE, R.SEVERE, R.LOW])
    assert score.miles_by_level[R.SEVERE] == 40  # 10–40 touches the SEVERE checkpoint
    score = score_route([0, 10, 20, 50], [R.SEVERE, R.SEVERE, R.LOW, R.LOW])
    assert score.avg_risk == pytest.approx((10 * 3 + 10 * 3 + 30 * 0) / 50)


def test_no_travel_detected():
    score = score_route([0, 10, 20], [R.LOW, R.NO_TRAVEL, R.LOW])
    assert score.has_no_travel
    assert score.no_travel_miles == 20


def test_single_checkpoint():
    score = score_route([0], [R.MODERATE])
    assert score.avg_risk == 1
    assert score.segments == []


def test_mismatched_input():
    with pytest.raises(ValueError):
        score_route([0, 10], [R.LOW])
