"""Classify the weather at one checkpoint into a risk level."""

from __future__ import annotations

from collections.abc import Sequence

from . import constants as c
from .models import CheckpointRisk, RiskLevel, Weather


def threshold(value: float, bounds: Sequence[c.Bound]) -> RiskLevel:
    for level, bound in zip(RiskLevel, bounds):
        if value < bound.value or (bound.inclusive and value == bound.value):
            return level
    return RiskLevel.NO_TRAVEL


def load_level(wind_mph: float, load_lb: float) -> RiskLevel:
    if wind_mph >= c.ANY_LOAD_NO_TRAVEL_WIND:
        return RiskLevel.NO_TRAVEL
    if wind_mph >= c.LOAD_NO_TRAVEL_WIND and load_lb > c.LOAD_NO_TRAVEL_WEIGHT_LB:
        return RiskLevel.NO_TRAVEL
    if wind_mph >= c.LOAD_SEVERE_WIND and load_lb > c.LOAD_SEVERE_WEIGHT_LB:
        return RiskLevel.SEVERE
    return RiskLevel.LOW


def classify(weather: Weather, load_lb: float) -> CheckpointRisk:
    wind = threshold(weather.wind_mph, c.WIND_MPH)
    rain = threshold(weather.rain_in_hr, c.RAIN_IN_HR)
    snow = threshold(weather.snow_in_hr, c.SNOW_IN_HR)
    load = load_level(weather.wind_mph, load_lb)
    level = max(wind, rain, snow, load)

    reasons: list[str] = []
    if level > RiskLevel.LOW:
        if wind == level:
            reasons.append(f"Wind {weather.wind_mph:.0f} mph")
        if rain == level:
            reasons.append(f"Rain {weather.rain_in_hr:.2f} in/hr")
        if snow == level:
            reasons.append(f"Snow {weather.snow_in_hr:.2f} in/hr")
        if load == level and load > wind:
            reasons.append(f"Wind {weather.wind_mph:.0f} mph with {load_lb:,.0f} lb load")

    return CheckpointRisk(
        level=level, wind=wind, rain=rain, snow=snow, load=load, reasons=tuple(reasons)
    )
