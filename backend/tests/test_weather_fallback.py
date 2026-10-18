import pytest
from django.core.cache import cache

from routing.providers.base import ProviderError
from routing.providers.fallback_weather import BLOCKED_KEY, FallbackWeather
from routing.providers.met_norway import parse


class Stub:
    def __init__(self, name, status=None):
        self.name, self.status, self.calls = name, status, 0

    def hourly(self, points):
        self.calls += 1
        if self.status:
            raise ProviderError("limited", status=self.status)
        return [self.name] * len(points)


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()


def test_uses_primary_when_available():
    w = FallbackWeather(Stub("om"), Stub("met"), "open-meteo", "met-norway")
    assert w.hourly([(1, 2)]) == ["om"]
    assert w.source == "open-meteo"


def test_switches_on_rate_limit_and_skips_primary_for_a_while():
    primary, backup = Stub("om", status=503), Stub("met")
    w = FallbackWeather(primary, backup, "open-meteo", "met-norway")
    assert w.hourly([(1, 2)]) == ["met"]
    assert w.source == "met-norway"
    assert cache.get(BLOCKED_KEY)

    w2 = FallbackWeather(primary, backup, "open-meteo", "met-norway")
    assert w2.hourly([(1, 2)]) == ["met"]
    assert primary.calls == 1  # not retried while blocked


def test_timeouts_and_outages_also_use_the_backup():
    w = FallbackWeather(Stub("om", status=502), Stub("met"), "open-meteo", "met-norway")
    assert w.hourly([(1, 2)]) == ["met"]
    assert w.source == "met-norway"


def test_bad_requests_are_not_hidden():
    w = FallbackWeather(Stub("om", status=400), Stub("met"), "open-meteo", "met-norway")
    with pytest.raises(ProviderError):
        w.hourly([(1, 2)])


def _entry(time, wind_ms, temp_c, precip_1h=None, precip_6h=None):
    data = {"instant": {"details": {"wind_speed": wind_ms, "air_temperature": temp_c}}}
    if precip_1h is not None:
        data["next_1_hours"] = {"details": {"precipitation_amount": precip_1h}}
    if precip_6h is not None:
        data["next_6_hours"] = {"details": {"precipitation_amount": precip_6h}}
    return {"time": time, "data": data}


def test_met_norway_parsing_matches_open_meteo_conventions():
    data = {
        "properties": {
            "timeseries": [
                _entry("2026-10-19T00:00:00Z", 10, 12, precip_1h=6.35),  # 0.25 in during 00–01
                _entry("2026-10-19T01:00:00Z", 20, 0, precip_1h=10),  # snow during 01–02
                _entry("2026-10-19T02:00:00Z", 5, 5, precip_6h=12),  # 2 mm/h during 02–08
                _entry("2026-10-19T08:00:00Z", 5, 5),
            ]
        }
    }
    s = parse(data)
    assert s.wind_mph[1] == pytest.approx(44.7, abs=0.1)  # 20 m/s
    assert s.temp_f[0] == pytest.approx(53.6)
    t0 = s.times[0]
    # Rate during 00:30 comes from the period that started at 00:00.
    assert s.at(t0 + 1800).rain_in_hr == pytest.approx(0.25, abs=0.001)
    # 01:30 is below freezing: 10 mm water → 7 cm → 2.76 in of snow.
    w = s.at(t0 + 5400)
    assert w.rain_in_hr == 0 and w.snow_in_hr == pytest.approx(2.756, abs=0.01)
    # Six-hour totals become an hourly rate.
    assert s.at(t0 + 3 * 3600).rain_in_hr == pytest.approx(2 / 25.4, abs=0.001)
