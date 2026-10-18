from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from routing.domain.models import Coord, RawRoute
from routing.domain.weather_series import HourlySeries


class ProviderError(Exception):
    """An upstream API failed or rejected the request."""

    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class Place:
    label: str
    lon: float
    lat: float


class Geocoder(Protocol):
    def autocomplete(self, text: str, size: int = 5) -> list[Place]: ...


class RoutingProvider(Protocol):
    def route(
        self,
        coords: list[Coord],
        gross_weight_t: float,
        alternatives: int = 0,
    ) -> list[RawRoute]: ...


class WeatherProvider(Protocol):
    def hourly(self, points: list[tuple[float, float]]) -> list[HourlySeries]:
        """Hourly forecast for each (lat, lon) point, in the same order."""
        ...
