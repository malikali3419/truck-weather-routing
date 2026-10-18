import pytest

from routing.domain.scenario import Storm

from .factories import weather

T = 1_800_000_000


def test_strongest_at_center_and_peak():
    storm = Storm(lat=40.0, lon=-100.0, peak_unix=T, drift_mph=0)
    assert storm.intensity(40.0, -100.0, T) == pytest.approx(1.0)
    assert storm.intensity(40.0, -100.0, T + 6 * 3600) == pytest.approx(0.3679, abs=1e-3)


def test_no_effect_outside_radius():
    storm = Storm(lat=40.0, lon=-100.0, peak_unix=T, radius_mi=50, drift_mph=0)
    assert storm.intensity(41.0, -100.0, T) == 0.0  # ~69 miles away
    w = weather(wind=10)
    assert storm.apply(w, 41.0, -100.0, T) is w


def test_storm_drifts_with_time():
    storm = Storm(lat=40.0, lon=-100.0, peak_unix=T, drift_mph=20, drift_bearing_deg=90)
    lat, lon = storm.center_at(T + 3 * 3600)
    assert lat == pytest.approx(40.0, abs=0.05)
    assert lon > -100.0  # moved east


def test_rain_when_warm_snow_when_freezing():
    storm = Storm(lat=40.0, lon=-100.0, peak_unix=T, drift_mph=0)
    warm = storm.apply(weather(wind=5, temp=60), 40.0, -100.0, T)
    cold = storm.apply(weather(wind=5, temp=20), 40.0, -100.0, T)
    assert warm.wind_mph == pytest.approx(53)
    assert warm.rain_in_hr > 0.5 and warm.snow_in_hr == 0
    assert cold.snow_in_hr > 2 and cold.rain_in_hr == 0


def test_round_trips_through_dict():
    storm = Storm(lat=40.0, lon=-100.0, peak_unix=T)
    assert Storm.from_dict(storm.to_dict()) == storm
