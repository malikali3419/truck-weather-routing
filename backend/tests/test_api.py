"""API tests with fake providers — no network."""

from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from routing.api import providers
from routing.domain.geo import cumulative_miles, destination_point, encode_polyline
from routing.domain.models import RawRoute
from routing.providers import alternatives

from .factories import flat_series

ORIGIN = (-104.99, 39.74)
DEST = (-87.63, 41.88)


def straight_route(a, b, n=200, mph=55.0) -> RawRoute:
    coords = [(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n) for i in range(n + 1)]
    miles = cumulative_miles(coords)
    return RawRoute(
        coords=coords,
        distance_m=miles[-1] * 1609.344,
        duration_s=miles[-1] / mph * 3600,
        vertex_times=[m / mph * 3600 for m in miles],
    )


class FakeRouting:
    """Direct route, plus a bent route through any via point."""

    def route(self, coords, gross_weight_t, alternatives=0):
        if len(coords) == 2:
            return [straight_route(coords[0], coords[1])]
        first = straight_route(coords[0], coords[1], n=100)
        second = straight_route(coords[1], coords[2], n=100)
        coords_all = first.coords + second.coords[1:]
        times = first.vertex_times + [first.duration_s + t for t in second.vertex_times[1:]]
        return [
            RawRoute(
                coords_all,
                first.distance_m + second.distance_m,
                first.duration_s + second.duration_s,
                times,
            )
        ]


class FakeWeather:
    def __init__(self, **values):
        self.values = values

    def hourly(self, points):
        start = int(timezone.now().timestamp()) // 3600 * 3600 - 3600
        return [flat_series(start, 24 * 9, **self.values) for _ in points]


@pytest.fixture
def client(monkeypatch):
    cache.clear()
    monkeypatch.setattr(providers, "routing", lambda: FakeRouting())
    monkeypatch.setattr(providers, "weather", lambda: FakeWeather())
    return APIClient()


def plan_body(**overrides):
    body = {
        "origin": {"lat": ORIGIN[1], "lon": ORIGIN[0], "label": "Denver"},
        "destination": {"lat": DEST[1], "lon": DEST[0], "label": "Chicago"},
        "departure_at": (timezone.now() + timedelta(hours=1)).isoformat(),
        "load_weight_lb": 42000,
        "sample_interval_mi": 25,
    }
    body.update(overrides)
    return body


def test_plan_returns_three_routes_and_recommendation(client):
    res = client.post("/api/plan", plan_body(), format="json")
    assert res.status_code == 200, res.json()
    data = res.json()
    assert [r["id"] for r in data["routes"]] == ["A", "B", "C"]
    route = data["routes"][0]
    assert route["checkpoints"][0]["mile"] == 0
    assert len(route["vertex_offsets_s"]) > 1
    etas = [cp["eta_unix"] for cp in route["checkpoints"]]
    assert etas == sorted(etas)
    assert data["recommendation"]["route_id"] == "A"  # calm weather → fastest wins


def test_windy_heavy_trip_is_no_travel(client, monkeypatch):
    monkeypatch.setattr(providers, "weather", lambda: FakeWeather(wind=48))
    data = client.post("/api/plan", plan_body(load_weight_lb=35000), format="json").json()
    assert all(r["summary"]["has_no_travel"] for r in data["routes"])
    assert data["recommendation"]["route_id"] is None
    assert data["recommendation"]["warning"]


@pytest.mark.parametrize(
    "override, field",
    [
        ({"sample_interval_mi": 15}, "sample_interval_mi"),
        ({"load_weight_lb": -5}, "load_weight_lb"),
        ({"departure_at": "2001-01-01T00:00:00Z"}, "departure_at"),
    ],
)
def test_plan_validation(client, override, field):
    res = client.post("/api/plan", plan_body(**override), format="json")
    assert res.status_code == 400
    assert field in res.json()


def test_heatmap_frames(client):
    line = [ORIGIN, destination_point(ORIGIN, 90, 100_000)]
    body = {
        "routes": [encode_polyline(line)],
        "departure_at": timezone.now().isoformat(),
        "load_weight_lb": 20000,
    }
    res = client.post("/api/heatmap", body, format="json")
    assert res.status_code == 200
    data = res.json()
    n = len(data["points"])
    assert 0 < n <= 360
    assert len(data["times_unix"]) == 49
    assert len(data["layers"]["risk"]) == 49
    assert all(len(frame) == n for frame in data["layers"]["risk"])


def test_alternatives_always_three_distinct_routes():
    routes = alternatives.generate_routes(FakeRouting(), ORIGIN, DEST, 30)
    assert len(routes) == 3
    for i, a in enumerate(routes):
        for b in routes[i + 1 :]:
            assert alternatives.overlap(a, b) < alternatives.MAX_OVERLAP


def test_simulated_storm_hits_fastest_route_and_changes_recommendation(client):
    calm = client.post("/api/plan", plan_body(), format="json").json()
    stormy = client.post("/api/plan", plan_body(simulate_storm=True), format="json").json()
    assert calm["scenario"] is None
    assert stormy["scenario"]["type"] == "storm"
    fastest = stormy["routes"][0]
    assert fastest["summary"]["max_level"] in ("SEVERE", "NO_TRAVEL")
    assert stormy["recommendation"]["route_id"] != "A"

    body = {
        "routes": [r["geometry"] for r in stormy["routes"]],
        "departure_at": timezone.now().isoformat(),
        "load_weight_lb": 42000,
        "scenario": stormy["scenario"],
    }
    heat = client.post("/api/heatmap", body, format="json").json()
    assert max(max(frame) for frame in heat["layers"]["risk"]) >= 3
