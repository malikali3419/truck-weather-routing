from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from routing.domain.scenario import Storm
from routing.providers.base import ProviderError
from routing.services.heatmap import build_heatmap
from routing.services.planner import TripRequest, plan_trip

from . import providers
from .serializers import HeatmapRequestSerializer, PlanRequestSerializer


def _provider_error(exc: ProviderError) -> Response:
    return Response({"detail": str(exc)}, status=exc.status)


class HealthView(APIView):
    throttle_classes: list = []

    def get(self, request: Request) -> Response:
        return Response({"status": "ok"})


class GeocodeView(APIView):
    def get(self, request: Request) -> Response:
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return Response({"results": []})
        try:
            places = providers.ors().autocomplete(q[:200])
        except ProviderError as exc:
            return _provider_error(exc)
        return Response(
            {"results": [{"label": p.label, "lat": p.lat, "lon": p.lon} for p in places]}
        )


class PlanView(APIView):
    def post(self, request: Request) -> Response:
        s = PlanRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        req = TripRequest(
            origin=(d["origin"]["lon"], d["origin"]["lat"]),
            destination=(d["destination"]["lon"], d["destination"]["lat"]),
            departure=d["departure_at"],
            load_lb=d["load_weight_lb"],
            interval_mi=int(d["sample_interval_mi"]),
            simulate_storm=d["simulate_storm"],
        )
        try:
            weather = providers.weather()
            return Response(plan_trip(req, providers.routing(), weather))
        except ProviderError as exc:
            return _provider_error(exc)


class HeatmapView(APIView):
    def post(self, request: Request) -> Response:
        s = HeatmapRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        try:
            weather = providers.weather()
            data = build_heatmap(
                d["routes"],
                d["departure_at"].timestamp(),
                d["load_weight_lb"],
                weather,
                storm=Storm.from_dict(d["scenario"]) if d.get("scenario") else None,
            )
        except ProviderError as exc:
            return _provider_error(exc)
        return Response({**data, "weather_source": getattr(weather, "source", "open-meteo")})
