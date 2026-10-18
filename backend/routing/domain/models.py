"""Plain data types shared by the domain logic. No Django, no HTTP."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum


class RiskLevel(IntEnum):
    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4

    @property
    def label(self) -> str:
        return self.name.replace("_", " ").title()


# (lon, lat) — same order as GeoJSON / OpenRouteService.
Coord = tuple[float, float]


@dataclass(frozen=True)
class Weather:
    wind_mph: float
    gust_mph: float
    rain_in_hr: float
    snow_in_hr: float
    temp_f: float
    weather_code: int
    beyond_forecast: bool = False


@dataclass(frozen=True)
class CheckpointRisk:
    level: RiskLevel
    wind: RiskLevel
    rain: RiskLevel
    snow: RiskLevel
    load: RiskLevel
    reasons: tuple[str, ...]


@dataclass
class RawRoute:
    """A route as returned by the routing provider."""

    coords: list[Coord]
    distance_m: float
    duration_s: float
    # Cumulative travel time in seconds at each vertex of `coords`.
    vertex_times: list[float]


@dataclass(frozen=True)
class SamplePoint:
    mile: float
    lon: float
    lat: float
    eta_offset_s: float


@dataclass
class Checkpoint:
    mile: float
    lon: float
    lat: float
    eta_unix: int
    weather: Weather
    risk: CheckpointRisk


@dataclass(frozen=True)
class Segment:
    from_mile: float
    to_mile: float
    level: RiskLevel


@dataclass
class RouteScore:
    miles_by_level: dict[RiskLevel, float]
    avg_risk: float
    max_level: RiskLevel
    segments: list[Segment] = field(default_factory=list)

    @property
    def severe_miles(self) -> float:
        return self.miles_by_level[RiskLevel.SEVERE]

    @property
    def high_miles(self) -> float:
        return self.miles_by_level[RiskLevel.HIGH]

    @property
    def no_travel_miles(self) -> float:
        return self.miles_by_level[RiskLevel.NO_TRAVEL]

    @property
    def has_no_travel(self) -> bool:
        return self.max_level == RiskLevel.NO_TRAVEL
