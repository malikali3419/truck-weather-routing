from routing.domain.models import Weather
from routing.domain.weather_series import HourlySeries


def weather(wind=0.0, rain=0.0, snow=0.0, gust=None, temp=50.0) -> Weather:
    return Weather(
        wind_mph=wind,
        gust_mph=gust if gust is not None else wind,
        rain_in_hr=rain,
        snow_in_hr=snow,
        temp_f=temp,
        weather_code=0,
    )


def flat_series(start: int, hours: int, **values) -> HourlySeries:
    """Same weather every hour."""
    n = hours + 1
    return HourlySeries(
        times=[start + h * 3600 for h in range(n)],
        wind_mph=[values.get("wind", 0.0)] * n,
        gust_mph=[values.get("gust", 0.0)] * n,
        rain_in=[values.get("rain", 0.0)] * n,
        showers_in=[0.0] * n,
        snow_in=[values.get("snow", 0.0)] * n,
        temp_f=[50.0] * n,
        weather_code=[0] * n,
    )
