from __future__ import annotations

from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from routing.domain.constants import SAMPLE_INTERVALS_MI
from routing.domain.geo import decode_polyline

MAX_DAYS_AHEAD = 7
MAX_LOAD_LB = 80_000


class PlaceSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lon = serializers.FloatField(min_value=-180, max_value=180)
    label = serializers.CharField(required=False, allow_blank=True, max_length=300)


def _validate_departure(value):
    now = timezone.now()
    if value < now - timedelta(hours=1):
        raise serializers.ValidationError("Departure time is in the past.")
    if value > now + timedelta(days=MAX_DAYS_AHEAD):
        raise serializers.ValidationError(
            f"Departure must be within {MAX_DAYS_AHEAD} days; forecasts beyond that are unreliable."
        )
    return value


class PlanRequestSerializer(serializers.Serializer):
    origin = PlaceSerializer()
    destination = PlaceSerializer()
    departure_at = serializers.DateTimeField(validators=[_validate_departure])
    load_weight_lb = serializers.FloatField(min_value=0, max_value=MAX_LOAD_LB)
    sample_interval_mi = serializers.ChoiceField(choices=SAMPLE_INTERVALS_MI, default=10)
    simulate_storm = serializers.BooleanField(default=False)

    def validate(self, attrs):
        o, d = attrs["origin"], attrs["destination"]
        if abs(o["lat"] - d["lat"]) < 1e-4 and abs(o["lon"] - d["lon"]) < 1e-4:
            raise serializers.ValidationError("Origin and destination are the same place.")
        return attrs


class StormSerializer(serializers.Serializer):
    """The simulated storm returned by /plan, echoed back for the heatmap."""

    lat = serializers.FloatField(min_value=-90, max_value=90)
    lon = serializers.FloatField(min_value=-180, max_value=180)
    peak_unix = serializers.IntegerField()


class HeatmapRequestSerializer(serializers.Serializer):
    routes = serializers.ListField(
        child=serializers.CharField(max_length=200_000), min_length=1, max_length=3
    )
    departure_at = serializers.DateTimeField()
    load_weight_lb = serializers.FloatField(min_value=0, max_value=MAX_LOAD_LB)
    scenario = StormSerializer(required=False, allow_null=True)

    def validate_routes(self, value):
        try:
            decoded = [decode_polyline(v) for v in value]
        except (IndexError, ValueError) as exc:
            raise serializers.ValidationError("Invalid encoded polyline.") from exc
        if any(len(r) < 2 for r in decoded):
            raise serializers.ValidationError("Each route needs at least two points.")
        return decoded
