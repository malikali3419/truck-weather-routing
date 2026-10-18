import pytest

from routing.domain import constants as c
from routing.domain.models import RiskLevel as R
from routing.domain.risk import classify, load_level, threshold

from .factories import weather


@pytest.mark.parametrize(
    "mph, expected",
    [
        (0, R.LOW),
        (24.9, R.LOW),
        (25, R.MODERATE),
        (34.9, R.MODERATE),
        (35, R.HIGH),
        (44.9, R.HIGH),
        (45, R.SEVERE),
        (54.9, R.SEVERE),
        (55, R.NO_TRAVEL),
        (80, R.NO_TRAVEL),
    ],
)
def test_wind_thresholds(mph, expected):
    assert threshold(mph, c.WIND_MPH) == expected


@pytest.mark.parametrize(
    "inches, expected",
    [
        (0.0, R.LOW),
        (0.099, R.LOW),
        (0.10, R.MODERATE),
        (0.249, R.MODERATE),
        (0.25, R.HIGH),
        (0.499, R.HIGH),
        (0.50, R.SEVERE),
        (1.00, R.SEVERE),
        (1.001, R.NO_TRAVEL),
    ],
)
def test_rain_thresholds(inches, expected):
    assert threshold(inches, c.RAIN_IN_HR) == expected


@pytest.mark.parametrize(
    "inches, expected",
    [
        (0.0, R.LOW),
        (0.49, R.LOW),
        (0.5, R.MODERATE),
        (0.99, R.MODERATE),
        (1.0, R.HIGH),
        (1.99, R.HIGH),
        (2.0, R.SEVERE),
        (3.0, R.SEVERE),
        (3.01, R.NO_TRAVEL),
    ],
)
def test_snow_thresholds(inches, expected):
    assert threshold(inches, c.SNOW_IN_HR) == expected


@pytest.mark.parametrize(
    "mph, load, expected",
    [
        (55, 0, R.NO_TRAVEL),  # >=55 mph: No Travel for any load
        (45, 30_001, R.NO_TRAVEL),  # 45–54 mph + >30,000 lb
        (54.9, 45_000, R.NO_TRAVEL),
        (45, 30_000, R.LOW),  # exactly 30,000 is not ">30,000"
        (44.9, 30_001, R.LOW),
        (35, 40_001, R.SEVERE),  # 35–44 mph + >40,000 lb
        (44.9, 50_000, R.SEVERE),
        (35, 40_000, R.LOW),  # exactly 40,000 is not ">40,000"
        (34.9, 50_000, R.LOW),
    ],
)
def test_load_rules(mph, load, expected):
    assert load_level(mph, load) == expected


def test_classify_takes_worst_factor():
    risk = classify(weather(wind=26, rain=0.3, snow=0.6), load_lb=10_000)
    assert risk.wind == R.MODERATE
    assert risk.rain == R.HIGH
    assert risk.snow == R.MODERATE
    assert risk.level == R.HIGH
    assert risk.reasons == ("Rain 0.30 in/hr",)


def test_heavy_load_raises_high_wind_to_severe():
    light = classify(weather(wind=38), load_lb=20_000)
    heavy = classify(weather(wind=38), load_lb=42_000)
    assert light.level == R.HIGH
    assert heavy.level == R.SEVERE
    assert heavy.reasons == ("Wind 38 mph with 42,000 lb load",)


def test_heavy_load_makes_severe_wind_no_travel():
    assert classify(weather(wind=47), load_lb=30_000).level == R.SEVERE
    assert classify(weather(wind=47), load_lb=35_000).level == R.NO_TRAVEL


def test_calm_weather_has_no_reasons():
    risk = classify(weather(wind=10), load_lb=80_000)
    assert risk.level == R.LOW
    assert risk.reasons == ()
