"""Use Open-Meteo; switch to the backup forecast when it is rate limited."""

from __future__ import annotations

import logging

from django.core.cache import cache

from routing.domain.weather_series import HourlySeries

from .base import ProviderError, WeatherProvider

log = logging.getLogger(__name__)

# After a failure, skip the primary for a while instead of spending a request
# (and seconds) on it for every trip: longer for rate limits, which last until
# the next hour, shorter for timeouts and outages.
BLOCKED_KEY = "weather:primary-blocked"
RATE_LIMITED_FOR_S = 10 * 60
UNAVAILABLE_FOR_S = 2 * 60


class FallbackWeather:
    """One instance per request, so `source` describes that request."""

    def __init__(
        self,
        primary: WeatherProvider,
        fallback: WeatherProvider,
        primary_name: str,
        fallback_name: str,
    ):
        self._primary = primary
        self._fallback = fallback
        self._names = (primary_name, fallback_name)
        self.source = primary_name

    def hourly(self, points: list[tuple[float, float]]) -> list[HourlySeries]:
        if not cache.get(BLOCKED_KEY):
            try:
                return self._primary.hourly(points)
            except ProviderError as exc:
                # 5xx = rate limited, timed out or down: try the backup.
                # Anything else means the request itself is wrong.
                if exc.status < 500:
                    raise
                log.warning("Primary weather unavailable (%s), using fallback", exc)
                blocked_for = RATE_LIMITED_FOR_S if exc.status == 503 else UNAVAILABLE_FOR_S
                cache.set(BLOCKED_KEY, True, blocked_for)
        self.source = self._names[1]
        return self._fallback.hourly(points)
