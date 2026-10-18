import pytest

from routing.domain.geo import cumulative_miles, decode_polyline, encode_polyline, simplify
from routing.domain.sampling import sample_route

# A straight line due north along a meridian: 1° of latitude ≈ 69.09 miles.
LINE = [(-100.0, 40.0 + i * 0.1) for i in range(11)]  # ~69 miles


def times_constant_speed(coords, mph=60.0):
    return [m / mph * 3600 for m in cumulative_miles(coords)]


def test_checkpoints_every_interval_plus_destination():
    pts = sample_route(LINE, times_constant_speed(LINE), 10)
    miles = [p.mile for p in pts]
    assert miles[:7] == [0, 10, 20, 30, 40, 50, 60]
    assert miles[-1] == pytest.approx(69.09, abs=0.05)
    assert len(pts) == 8


@pytest.mark.parametrize("interval, expected_count", [(10, 8), (25, 4), (50, 3)])
def test_interval_controls_count(interval, expected_count):
    assert len(sample_route(LINE, times_constant_speed(LINE), interval)) == expected_count


def test_first_and_last_points_are_route_ends():
    pts = sample_route(LINE, times_constant_speed(LINE), 25)
    assert (pts[0].lon, pts[0].lat) == LINE[0]
    assert (pts[-1].lon, pts[-1].lat) == LINE[-1]


def test_eta_interpolated_from_vertex_times():
    pts = sample_route(LINE, times_constant_speed(LINE, mph=60), 10)
    # 60 mph → 10 miles every 10 minutes.
    assert pts[1].eta_offset_s == pytest.approx(600, abs=1)
    assert pts[3].eta_offset_s == pytest.approx(1800, abs=1)


def test_eta_follows_uneven_speeds():
    # First half crawls (vertex 0→5 takes 2 h), second half is fast (30 min).
    times = [i * 1440.0 for i in range(6)] + [7200 + i * 360.0 for i in range(1, 6)]
    pts = sample_route(LINE, times, 10)
    etas = [p.eta_offset_s for p in pts]
    assert etas == sorted(etas)
    assert pts[-1].eta_offset_s == pytest.approx(9000)
    # Mile 30 is inside the slow half (~43% of the way, ~5,400 s at the slow pace).
    assert pts[3].eta_offset_s > 5000


def test_rejects_bad_input():
    with pytest.raises(ValueError):
        sample_route(LINE, times_constant_speed(LINE), 0)
    with pytest.raises(ValueError):
        sample_route(LINE, [0.0], 10)


def test_polyline_round_trip():
    coords = [(-104.98765, 39.74321), (-87.62981, 41.87811), (-87.6, 41.9)]
    assert decode_polyline(encode_polyline(coords)) == pytest.approx(coords, abs=1e-5)


def test_simplify_keeps_ends_and_drops_collinear_points():
    keep = simplify(LINE, 0.0001)
    assert keep == [0, len(LINE) - 1]
