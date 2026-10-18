"""Provider instances, created once per process so HTTP connections are reused."""

from __future__ import annotations

from functools import cache

from django.conf import settings

from routing.providers.fallback import FallbackRouting
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
def weather() -> OpenMeteoClient:
    return OpenMeteoClient()
