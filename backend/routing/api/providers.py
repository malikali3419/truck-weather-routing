"""Provider instances, created once per process so HTTP connections are reused."""

from __future__ import annotations

from functools import cache

from django.conf import settings

from routing.providers.fallback import FallbackRouting
from routing.providers.fallback_weather import FallbackWeather
from routing.providers.met_norway import MetNorwayClient
from routing.providers.open_meteo import OpenMeteoClient
from routing.providers.ors import OrsClient
from routing.providers.osrm import OsrmClient


@cache
def ors() -> OrsClient:
    return OrsClient(settings.ORS_API_KEY, settings.ORS_BASE_URL)


@cache
def osrm() -> OsrmClient:
    return OsrmClient(settings.OSRM_BASE_URL)


def routing() -> FallbackRouting:
    """A fresh fallback wrapper per trip (it remembers which engine answered)."""
    return FallbackRouting(ors(), osrm(), "openrouteservice", "osrm")


@cache
def open_meteo() -> OpenMeteoClient:
    return OpenMeteoClient()


@cache
def met_norway() -> MetNorwayClient:
    return MetNorwayClient()


def weather() -> FallbackWeather:
    """A fresh fallback wrapper per request (it records which source answered)."""
    return FallbackWeather(open_meteo(), met_norway(), "open-meteo", "met-norway")
