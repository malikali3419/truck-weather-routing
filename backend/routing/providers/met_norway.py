"""MET Norway Locationforecast: fallback weather when Open-Meteo is rate limited.

Free, global and keyless, but one location per request, so points are
fetched in parallel and cached. The API asks clients to identify themselves
with a User-Agent and to round coordinates to at most 4 decimals.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import httpx
from django.core.cache import cache

from routing.domain.weather_series import HourlySeries

from .base import ProviderError

URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
USER_AGENT = "truck-weather-routing/1.0 github.com/malikali3419/truck-weather-routing"
CACHE_TTL_S = 60 * 60
MAX_WORKERS = 12
MS_TO_MPH = 2.23694
MM_TO_IN = 1 / 25.4
SNOW_TEMP_C = 0.5
# Open-Meteo's convention: 1 mm of water falls as 0.7 cm of snow.
SNOW_CM_PER_MM = 0.7


class MetNorwayClient:
    def __init__(self, timeout: float = 15.0):
        self._http = httpx.Client(timeout=timeout, headers={"User-Agent": USER_AGENT})

    def hourly(self, points: list[tuple[float, float]]) -> list[HourlySeries]:
        keys = [_cache_key(p) for p in points]
        found = cache.get_many(list(set(keys)))
        missing = sorted({p for p, k in zip(points, keys) if k not in found})
        if missing:
            with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(missing))) as pool:
                fresh = dict(zip((_cache_key(p) for p in missing), pool.map(self._fetch, missing)))
            cache.set_many(fresh, CACHE_TTL_S)
            found.update(fresh)
        return [found[k] for k in keys]

    def _fetch(self, point: tuple[float, float]) -> HourlySeries:
        lat, lon = point
        try:
            res = self._http.get(URL, params={"lat": f"{lat:.4f}", "lon": f"{lon:.4f}"})
        except httpx.HTTPError as exc:
            raise ProviderError(f"Backup weather service unreachable: {exc}") from exc
        if res.status_code == 429:
            raise ProviderError("Weather services are busy, please try again in a few minutes", 503)
        if res.status_code >= 400:
            raise ProviderError(f"Backup weather service error {res.status_code}")
        return parse(res.json())


def parse(data: dict) -> HourlySeries:
    """Convert a Locationforecast response into the same shape Open-Meteo gives.

    MET reports precipitation for the period that STARTS at each timestamp
    (next 1 h, or next 6 h further out). HourlySeries expects totals for the
    hour that ENDS at each timestamp, so each period's rate is stored on the
    following entry.
    """
    entries = data["properties"]["timeseries"]
    times: list[int] = []
    wind: list[float] = []
    temp_f: list[float] = []
    rates_mm_hr: list[float] = []  # precipitation rate starting at each entry
    temps_c: list[float] = []
    for e in entries:
        details = e["data"]["instant"]["details"]
        times.append(int(datetime.fromisoformat(e["time"].replace("Z", "+00:00")).timestamp()))
        wind.append(details.get("wind_speed", 0.0) * MS_TO_MPH)
        t_c = details.get("air_temperature", 10.0)
        temps_c.append(t_c)
        temp_f.append(t_c * 9 / 5 + 32)
        if "next_1_hours" in e["data"]:
            rate = e["data"]["next_1_hours"]["details"].get("precipitation_amount", 0.0)
        elif "next_6_hours" in e["data"]:
            rate = e["data"]["next_6_hours"]["details"].get("precipitation_amount", 0.0) / 6
        else:
            rate = 0.0
        rates_mm_hr.append(rate)

    rain_in: list[float] = []
    snow_in: list[float] = []
    for i in range(len(times)):
        # The bucket ending at entry i is the period that started at entry i-1.
        j = max(i - 1, 0)
        mm = rates_mm_hr[j]
        if temps_c[j] <= SNOW_TEMP_C:
            rain_in.append(0.0)
            snow_in.append(mm * SNOW_CM_PER_MM / 2.54)
        else:
            rain_in.append(mm * MM_TO_IN)
            snow_in.append(0.0)

    n = len(times)
    return HourlySeries(
        times=times,
        wind_mph=wind,
        # The compact product has no gusts; sustained wind is what the risk rules use.
        gust_mph=list(wind),
        rain_in=rain_in,
        showers_in=[0.0] * n,
        snow_in=snow_in,
        temp_f=temp_f,
        weather_code=[0] * n,
    )


def _cache_key(point: tuple[float, float]) -> str:
    return f"met:{point[0]:.4f}:{point[1]:.4f}"
