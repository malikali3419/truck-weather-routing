"""Read an hourly forecast at an arbitrary moment."""

from __future__ import annotations

import bisect
from dataclasses import dataclass

from .models import Weather

HOUR = 3600


@dataclass(frozen=True)
class HourlySeries:
    """Hourly forecast for one location. `times` are unix seconds (UTC)."""

    times: list[int]
    wind_mph: list[float]
    gust_mph: list[float]
    rain_in: list[float]
    showers_in: list[float]
    snow_in: list[float]
    temp_f: list[float]
    weather_code: list[int]

    def at(self, t: float) -> Weather:
        """Weather at time `t`.

        Wind, gusts and temperature are instantaneous, so they are linearly
        interpolated between the surrounding hours. Rain, showers and snowfall
        are hourly totals stamped at the END of their hour, so the rate at `t`
        is the total of the hour that contains `t`.
        """
        times = self.times
        beyond = t < times[0] or t > times[-1]

        # Instantaneous values.
        if t <= times[0]:
            i, frac = 0, 0.0
        elif t >= times[-1]:
            i, frac = len(times) - 2, 1.0
        else:
            i = bisect.bisect_right(times, t) - 1
            frac = (t - times[i]) / (times[i + 1] - times[i])

        def interp(values: list[float]) -> float:
            if len(values) == 1:
                return values[0]
            return values[i] + (values[i + 1] - values[i]) * frac

        # Accumulated values: the bucket ending at the next full hour.
        bucket_end = (int(t) // HOUR) * HOUR + HOUR
        j = bisect.bisect_left(times, bucket_end)
        j = min(max(j, 0), len(times) - 1)

        return Weather(
            wind_mph=round(interp(self.wind_mph), 1),
            gust_mph=round(interp(self.gust_mph), 1),
            rain_in_hr=round(self.rain_in[j] + self.showers_in[j], 3),
            snow_in_hr=round(self.snow_in[j], 3),
            temp_f=round(interp(self.temp_f), 1),
            weather_code=self.weather_code[j],
            beyond_forecast=beyond,
        )
