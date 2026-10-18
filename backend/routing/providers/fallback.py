"""Try the primary routing provider; switch to the fallback if it is down."""

from __future__ import annotations

import logging

from routing.domain.models import Coord, RawRoute

from .base import ProviderError, RoutingProvider

log = logging.getLogger(__name__)


class FallbackRouting:
    """Use one instance per trip.

    Only the first call (the main route) may switch providers. After that
    the trip sticks with whichever provider answered, so all three routes
    come from the same routing engine and stay comparable.
    """

    def __init__(
        self,
        primary: RoutingProvider,
        fallback: RoutingProvider,
        primary_name: str,
        fallback_name: str,
    ):
        self._primary = primary
        self._fallback = fallback
        self._names = (primary_name, fallback_name)
        self.used_fallback = False
        self._decided = False

    @property
    def source(self) -> str:
        return self._names[1] if self.used_fallback else self._names[0]

    def route(
        self, coords: list[Coord], gross_weight_t: float, alternatives: int = 0
    ) -> list[RawRoute]:
        if self.used_fallback:
            return self._fallback.route(coords, gross_weight_t, alternatives)
        if self._decided:
            return self._primary.route(coords, gross_weight_t, alternatives)
        try:
            routes = self._primary.route(coords, gross_weight_t, alternatives)
        except ProviderError as exc:
            # 4xx means the request itself can't be routed; don't retry it elsewhere.
            if exc.status < 500:
                raise
            log.warning("Primary routing failed (%s), using fallback", exc)
            self.used_fallback = True
            routes = self._fallback.route(coords, gross_weight_t, alternatives)
        self._decided = True
        return routes
