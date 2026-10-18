"""OpenRouteService (HeiGIT): truck routing and geocoding."""

from __future__ import annotations

import httpx

from routing.domain.geo import haversine_m
from routing.domain.models import Coord, RawRoute

from .base import Place, ProviderError

ROUTE_PATH = "/openrouteservice/v2/directions/driving-hgv/geojson"
GEOCODE_PATH = "/pelias/v1/autocomplete"

# ORS error codes worth translating for the user.
_ERRORS = {
    2004: "Route is too long for this routing request",
    2009: "No truck route could be found between these places",
    2010: "One of the places is not near a road a truck can use",
}


class OrsClient:
    def __init__(self, api_key: str, base_url: str, timeout: float = 10.0):
        if not api_key:
            raise ProviderError("ORS_API_KEY is not configured", status=500)
        self._http = httpx.Client(
            base_url=base_url,
            headers={"Authorization": api_key},
            timeout=timeout,
        )

    def autocomplete(self, text: str, size: int = 5) -> list[Place]:
        data = self._send(
            "GET",
            GEOCODE_PATH,
            params={
                "text": text,
                "size": size,
                "layers": "address,venue,street,locality,localadmin,county,postalcode",
            },
        )
        return [
            Place(
                label=f["properties"].get("label", ""),
                lon=f["geometry"]["coordinates"][0],
                lat=f["geometry"]["coordinates"][1],
            )
            for f in data.get("features", [])
        ]

    def route(
        self,
        coords: list[Coord],
        gross_weight_t: float,
        alternatives: int = 0,
    ) -> list[RawRoute]:
        body: dict = {
            "coordinates": [list(c) for c in coords],
            # -1 lets via points snap to the nearest road however far it is.
            "radiuses": [-1] * len(coords),
            "instructions": True,
            "options": {
                "vehicle_type": "hgv",
                "profile_params": {"restrictions": {"weight": round(gross_weight_t, 1)}},
            },
        }
        if alternatives:
            body["alternative_routes"] = {
                "target_count": alternatives + 1,
                "weight_factor": 1.6,
                "share_factor": 0.6,
            }
        data = self._send("POST", ROUTE_PATH, json=body)
        return [_parse_feature(f) for f in data.get("features", [])]

    def _send(self, method: str, path: str, attempts: int = 1, **kwargs) -> dict:
        """Send a request. Slow answers surface as a 504 so callers can fall back."""
        for attempt in range(attempts):
            try:
                return self._json(self._http.request(method, path, **kwargs))
            except httpx.TimeoutException as exc:
                if attempt == attempts - 1:
                    raise ProviderError(
                        "Routing service is slow to respond, please try again", status=504
                    ) from exc
            except httpx.HTTPError as exc:
                raise ProviderError(f"Routing service unreachable: {exc}") from exc
        raise AssertionError("unreachable")

    def _json(self, res: httpx.Response) -> dict:
        try:
            data = res.json()
        except ValueError as exc:
            raise ProviderError(f"Routing service returned HTTP {res.status_code}") from exc
        if res.status_code >= 400 or "error" in data:
            err = data.get("error", {})
            code = err.get("code") if isinstance(err, dict) else None
            message = _ERRORS.get(code) or (
                err.get("message") if isinstance(err, dict) else str(err)
            )
            status = 422 if code in _ERRORS else 502
            if res.status_code == 429:
                message, status = "Routing service rate limit reached, try again shortly", 503
            raise ProviderError(message or "Routing service error", status=status)
        return data


def _parse_feature(feature: dict) -> RawRoute:
    coords: list[Coord] = [(c[0], c[1]) for c in feature["geometry"]["coordinates"]]
    props = feature["properties"]
    summary = props.get("summary", {})
    return RawRoute(
        coords=coords,
        distance_m=summary.get("distance", 0.0),
        duration_s=summary.get("duration", 0.0),
        vertex_times=_vertex_times(coords, props.get("segments", [])),
    )


def _vertex_times(coords: list[Coord], segments: list[dict]) -> list[float]:
    """Cumulative seconds at every vertex.

    Each ORS step covers a vertex range and has its own duration; within a
    step the time is spread in proportion to distance.
    """
    times = [0.0] * len(coords)
    elapsed = 0.0
    for segment in segments:
        for step in segment.get("steps", []):
            start, end = step["way_points"]
            duration = step.get("duration", 0.0)
            if end <= start:
                continue
            lengths = [haversine_m(coords[i], coords[i + 1]) for i in range(start, end)]
            total = sum(lengths)
            acc = 0.0
            for k, i in enumerate(range(start + 1, end + 1)):
                acc += lengths[k]
                frac = acc / total if total else (k + 1) / len(lengths)
                times[i] = elapsed + duration * frac
            elapsed += duration
    # Keep times monotonic even if steps were missing.
    for i in range(1, len(times)):
        times[i] = max(times[i], times[i - 1])
    return times
