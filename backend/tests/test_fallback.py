import pytest

from routing.providers.base import ProviderError
from routing.providers.fallback import FallbackRouting


class Stub:
    def __init__(self, name, fail_status=None, fail_after=None):
        self.name, self.fail_status, self.fail_after, self.calls = name, fail_status, fail_after, 0

    def route(self, coords, gross_weight_t, alternatives=0):
        self.calls += 1
        if self.fail_status and (self.fail_after is None or self.calls > self.fail_after):
            raise ProviderError("down", status=self.fail_status)
        return [self.name]


def test_uses_primary_when_healthy():
    r = FallbackRouting(Stub("ors"), Stub("osrm"), "ors", "osrm")
    assert r.route([], 30) == ["ors"]
    assert r.source == "ors"


def test_switches_when_main_route_times_out_and_stays_switched():
    primary, fallback = Stub("ors", fail_status=504), Stub("osrm")
    r = FallbackRouting(primary, fallback, "ors", "osrm")
    assert r.route([], 30) == ["osrm"]
    assert r.route([], 30) == ["osrm"]
    assert primary.calls == 1
    assert r.source == "osrm"


def test_no_fallback_for_unroutable_requests():
    r = FallbackRouting(Stub("ors", fail_status=422), Stub("osrm"), "ors", "osrm")
    with pytest.raises(ProviderError):
        r.route([], 30)


def test_later_failures_do_not_mix_engines():
    # Main route from ORS succeeds, a later via-route call fails: it must
    # raise (so that candidate is skipped) rather than come from OSRM.
    r = FallbackRouting(Stub("ors", fail_status=504, fail_after=1), Stub("osrm"), "ors", "osrm")
    assert r.route([], 30) == ["ors"]
    with pytest.raises(ProviderError):
        r.route([], 30)
    assert r.source == "ors"
