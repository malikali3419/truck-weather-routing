"""Open-Meteo hourly forecast, batched and cached per location."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import httpx
from django.core.cache import cache

from routing.domain.weather_series import HourlySeries

from .base import ProviderError

URL = "https://api.open-meteo.com/v1/forecast"
HOURLY_VARS = (
    "wind_speed_10m",
    "wind_gusts_10m",
    "rain",
    "showers",
    "snowfall",
    "temperature_2m",
    "weather_code",
)
CHUNK = 100
FORECAST_DAYS = 10
CACHE_TTL_S = 60 * 60


class OpenMeteoClient:
    def __init__(self, timeout: float = 20.0):
        self._http = httpx.Client(timeout=timeout)

    def hourly(self, points: list[tuple[float, float]]) -> list[HourlySeries]:
        """Forecast for each (lat, lon). Coordinates should already be rounded
        (see `snap`) so nearby requests share cache entries."""
        keys = [_cache_key(p) for p in points]
        found = cache.get_many(list(set(keys)))
        missing = sorted({p for p, k in zip(points, keys) if k not in found})

        chunks = [missing[i : i + CHUNK] for i in range(0, len(missing), CHUNK)]
        if chunks:
            with ThreadPoolExecutor(max_workers=min(4, len(chunks))) as pool:
                for chunk, series in zip(chunks, pool.map(self._fetch, chunks)):
                    fresh = {_cache_key(p): s for p, s in zip(chunk, series)}
                    cache.set_many(fresh, CACHE_TTL_S)
                    found.update(fresh)

        return [found[k] for k in keys]

    def _fetch(self, points: list[tuple[float, float]]) -> list[HourlySeries]:
        params = {
            "latitude": ",".join(f"{lat:.4f}" for lat, _ in points),
            "longitude": ",".join(f"{lon:.4f}" for _, lon in points),
            "hourly": ",".join(HOURLY_VARS),
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",
            "temperature_unit": "fahrenheit",
            "timeformat": "unixtime",
            "timezone": "GMT",
            "forecast_days": FORECAST_DAYS,
        }
        try:
            res = self._http.get(URL, params=params)
        except httpx.HTTPError as exc:
            raise ProviderError(f"Weather service unreachable: {exc}") from exc
        if res.status_code == 429:
            raise ProviderError("Weather service rate limit reached, try again shortly", 503)
        if res.status_code >= 400:
            reason = (
                res.json().get("reason", "")
                if res.headers.get("content-type", "").startswith("application/json")
                else ""
            )
            raise ProviderError(f"Weather service error {res.status_code} {reason}".strip())

        data = res.json()
        items = data if isinstance(data, list) else [data]
        return [_parse(item["hourly"]) for item in items]


def snap(lat: float, lon: float, step: float) -> tuple[float, float]:
    """Round a point to a grid so nearby lookups share one forecast."""
    return (round(round(lat / step) * step, 4), round(round(lon / step) * step, 4))


def _cache_key(point: tuple[float, float]) -> str:
    return f"wx:{point[0]:.4f}:{point[1]:.4f}"


def _num(values: list) -> list[float]:
    return [0.0 if v is None else float(v) for v in values]


def _parse(hourly: dict) -> HourlySeries:
    return HourlySeries(
        times=[int(t) for t in hourly["time"]],
        wind_mph=_num(hourly["wind_speed_10m"]),
        gust_mph=_num(hourly["wind_gusts_10m"]),
        rain_in=_num(hourly["rain"]),
        showers_in=_num(hourly["showers"]),
        snow_in=_num(hourly["snowfall"]),
        temp_f=_num(hourly["temperature_2m"]),
        weather_code=[0 if v is None else int(v) for v in hourly["weather_code"]],
    )
