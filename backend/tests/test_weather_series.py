import pytest

from routing.domain.weather_series import HourlySeries

T0 = 1_800_000_000 - (1_800_000_000 % 3600)  # an exact hour


def series() -> HourlySeries:
    return HourlySeries(
        times=[T0, T0 + 3600, T0 + 7200],
        wind_mph=[10.0, 30.0, 50.0],
        gust_mph=[15.0, 35.0, 55.0],
        # Totals for the hour ENDING at each stamp.
        rain_in=[0.0, 0.2, 0.6],
        showers_in=[0.0, 0.05, 0.0],
        snow_in=[0.0, 0.0, 1.5],
        temp_f=[40.0, 42.0, 44.0],
        weather_code=[0, 61, 71],
    )


def test_wind_is_interpolated_between_hours():
    assert series().at(T0 + 1800).wind_mph == pytest.approx(20.0)
    assert series().at(T0 + 5400).wind_mph == pytest.approx(40.0)


def test_precipitation_uses_the_hour_containing_t():
    # 00:30 falls in the hour 00:00–01:00, whose total is stamped at 01:00.
    w = series().at(T0 + 1800)
    assert w.rain_in_hr == pytest.approx(0.25)  # rain + showers
    assert w.snow_in_hr == 0.0
    # 01:00 exactly starts the 01:00–02:00 hour.
    assert series().at(T0 + 3600).snow_in_hr == pytest.approx(1.5)


def test_outside_forecast_is_clamped_and_flagged():
    w = series().at(T0 + 10 * 3600)
    assert w.beyond_forecast
    assert w.wind_mph == 50.0
    assert not series().at(T0 + 60).beyond_forecast
