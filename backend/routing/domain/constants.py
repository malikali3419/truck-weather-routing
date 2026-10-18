"""Risk thresholds from the assessment brief — the single source of truth.

Each table lists the upper bound of LOW, MODERATE, HIGH and SEVERE in order.
Anything above the last bound is NO_TRAVEL. `inclusive` says whether a value
equal to the bound still belongs to that level.

Overlapping ranges in the brief (e.g. rain "0.10–0.25" and "0.25–0.50") are
resolved as lower-bound-inclusive. The brief writes the top band as ">1.00"
and ">3.0", so 1.00 in/hr rain and 3.0 in/hr snow are still SEVERE.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Bound:
    value: float
    inclusive: bool = False


WIND_MPH = (Bound(25), Bound(35), Bound(45), Bound(55))
RAIN_IN_HR = (Bound(0.10), Bound(0.25), Bound(0.50), Bound(1.00, inclusive=True))
SNOW_IN_HR = (Bound(0.5), Bound(1.0), Bound(2.0), Bound(3.0, inclusive=True))

# Load rules (sustained wind, mph; load, lb).
LOAD_NO_TRAVEL_WIND = 45
LOAD_NO_TRAVEL_WEIGHT_LB = 30_000
LOAD_SEVERE_WIND = 35
LOAD_SEVERE_WEIGHT_LB = 40_000
ANY_LOAD_NO_TRAVEL_WIND = 55

# Recommendation tolerances: differences smaller than these do not decide.
MILES_TOLERANCE = 1.0
AVG_RISK_TOLERANCE = 0.05

SAMPLE_INTERVALS_MI = (10, 25, 50)

METERS_PER_MILE = 1609.344
EARTH_RADIUS_M = 6_371_008.8

# Assumed empty tractor-trailer weight, added to the load for truck routing.
TRUCK_TARE_LB = 35_000
LB_PER_TONNE = 2204.62
