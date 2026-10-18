"""Small geometry helpers on (lon, lat) coordinates."""

from __future__ import annotations

import math
from collections.abc import Sequence

from .constants import EARTH_RADIUS_M, METERS_PER_MILE
from .models import Coord


def haversine_m(a: Coord, b: Coord) -> float:
    lon1, lat1 = map(math.radians, a)
    lon2, lat2 = map(math.radians, b)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def cumulative_miles(coords: Sequence[Coord]) -> list[float]:
    out = [0.0]
    for prev, cur in zip(coords, coords[1:]):
        out.append(out[-1] + haversine_m(prev, cur) / METERS_PER_MILE)
    return out


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def bearing_deg(a: Coord, b: Coord) -> float:
    lon1, lat1 = map(math.radians, a)
    lon2, lat2 = map(math.radians, b)
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def destination_point(origin: Coord, bearing: float, distance_m: float) -> Coord:
    lon1, lat1 = map(math.radians, origin)
    brg = math.radians(bearing)
    d = distance_m / EARTH_RADIUS_M
    lat2 = math.asin(math.sin(lat1) * math.cos(d) + math.cos(lat1) * math.sin(d) * math.cos(brg))
    lon2 = lon1 + math.atan2(
        math.sin(brg) * math.sin(d) * math.cos(lat1),
        math.cos(d) - math.sin(lat1) * math.sin(lat2),
    )
    return (math.degrees(lon2), math.degrees(lat2))


def point_at_mile(
    coords: Sequence[Coord], miles: Sequence[float], target: float
) -> tuple[Coord, int, float]:
    """Point at `target` miles along the line.

    Returns the point, the index of the vertex that starts its segment, and
    the fraction along that segment.
    """
    if target <= 0:
        return coords[0], 0, 0.0
    if target >= miles[-1]:
        return coords[-1], len(coords) - 1, 0.0
    lo, hi = 0, len(miles) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if miles[mid] <= target:
            lo = mid
        else:
            hi = mid
    span = miles[hi] - miles[lo]
    t = (target - miles[lo]) / span if span else 0.0
    a, b = coords[lo], coords[hi]
    return (lerp(a[0], b[0], t), lerp(a[1], b[1], t)), lo, t


def simplify(coords: Sequence[Coord], tolerance_deg: float) -> list[int]:
    """Douglas–Peucker. Returns the indices of the vertices to keep."""
    n = len(coords)
    if n < 3:
        return list(range(n))
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    tol2 = tolerance_deg**2
    while stack:
        start, end = stack.pop()
        ax, ay = coords[start]
        bx, by = coords[end]
        dx, dy = bx - ax, by - ay
        seg2 = dx * dx + dy * dy
        best, best_i = -1.0, -1
        for i in range(start + 1, end):
            px, py = coords[i]
            if seg2 == 0:
                d2 = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg2))
                d2 = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d2 > best:
                best, best_i = d2, i
        if best > tol2:
            keep[best_i] = True
            stack.append((start, best_i))
            stack.append((best_i, end))
    return [i for i, k in enumerate(keep) if k]


def encode_polyline(coords: Sequence[Coord], precision: int = 5) -> str:
    """Google encoded polyline (lat, lon order)."""
    factor = 10**precision
    out: list[str] = []
    prev_lat = prev_lon = 0
    for lon, lat in coords:
        ilat, ilon = round(lat * factor), round(lon * factor)
        for delta in (ilat - prev_lat, ilon - prev_lon):
            v = ~(delta << 1) if delta < 0 else delta << 1
            while v >= 0x20:
                out.append(chr((0x20 | (v & 0x1F)) + 63))
                v >>= 5
            out.append(chr(v + 63))
        prev_lat, prev_lon = ilat, ilon
    return "".join(out)


def decode_polyline(encoded: str, precision: int = 5) -> list[Coord]:
    factor = 10**precision
    coords: list[Coord] = []
    index = lat = lon = 0
    while index < len(encoded):
        values = []
        for _ in range(2):
            shift = result = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            values.append(~(result >> 1) if result & 1 else result >> 1)
        lat += values[0]
        lon += values[1]
        coords.append((lon / factor, lat / factor))
    return coords
