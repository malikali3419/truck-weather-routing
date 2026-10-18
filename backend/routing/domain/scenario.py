"""Optional simulated storm, layered on top of the real forecast.

Used only when the user turns on "Simulate a storm" — handy for demos when
the real weather along a route is calm. The storm is a moving cell whose
strength falls off with distance from its center and with time from its
peak.

Its peak wind sits in the 45–54 mph band on purpose: there the load rules
decide the outcome (No Travel above 30,000 lb, Severe otherwise), so the
demo shows how load weight changes whether a truck may travel. Real weather
is never made calmer: the storm only raises values.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, replace

from .constants import METERS_PER_MILE
from .geo import destination_point, haversine_m
from .models import Weather

FREEZING_F = 34.0


@dataclass(frozen=True)
class Storm:
    lat: float
    lon: float
    peak_unix: int
    radius_mi: float = 120.0
    # Hours either side of the peak at which strength has dropped to ~37%.
    half_life_h: float = 6.0
    drift_mph: float = 15.0
    drift_bearing_deg: float = 70.0
    peak_wind_mph: float = 50.0
    rain_in_hr: float = 0.45
    snow_in_hr: float = 1.5

    def center_at(self, t: float) -> tuple[float, float]:
        hours = (t - self.peak_unix) / 3600
        distance = self.drift_mph * hours * METERS_PER_MILE
        bearing = self.drift_bearing_deg if distance >= 0 else (self.drift_bearing_deg + 180) % 360
        lon, lat = destination_point((self.lon, self.lat), bearing, abs(distance))
        return lat, lon

    def intensity(self, lat: float, lon: float, t: float) -> float:
        """0 (no effect) to 1 (storm center at its peak)."""
        clat, clon = self.center_at(t)
        d_mi = haversine_m((lon, lat), (clon, clat)) / METERS_PER_MILE
        if d_mi >= self.radius_mi:
            return 0.0
        spatial = 0.5 * (1 + math.cos(math.pi * d_mi / self.radius_mi))
        temporal = math.exp(-(((t - self.peak_unix) / 3600 / self.half_life_h) ** 2))
        return spatial * temporal

    def apply(self, w: Weather, lat: float, lon: float, t: float) -> Weather:
        k = self.intensity(lat, lon, t)
        if k <= 0.01:
            return w
        if w.temp_f <= FREEZING_F:
            precip = {"snow_in_hr": round(w.snow_in_hr + self.snow_in_hr * k, 3)}
        else:
            precip = {"rain_in_hr": round(w.rain_in_hr + self.rain_in_hr * k, 3)}
        # sqrt widens the windy ring: 50 mph at the center, 35 mph at k≈0.5.
        storm_wind = self.peak_wind_mph * math.sqrt(k)
        return replace(
            w,
            wind_mph=round(max(w.wind_mph, storm_wind), 1),
            gust_mph=round(max(w.gust_mph, storm_wind * 1.3), 1),
            **precip,
        )

    def to_dict(self) -> dict:
        return {"type": "storm", **asdict(self)}

    @classmethod
    def from_dict(cls, data: dict) -> Storm:
        fields = {k: v for k, v in data.items() if k in cls.__dataclass_fields__}
        return cls(**fields)
