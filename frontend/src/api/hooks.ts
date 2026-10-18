import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTripStore } from "../store/useTripStore";
import { cumulativeMiles, decodePolyline, type LngLat } from "../lib/geo";
import { api } from "./client";
import type { PlannedRoute, PlanRequest } from "./types";

export function useGeocode(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["geocode", q],
    queryFn: ({ signal }) => api.geocode(q, signal),
    enabled: q.length >= 3,
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function usePlanTrip() {
  const setPlan = useTripStore((s) => s.setPlan);
  return useMutation({
    mutationFn: (req: PlanRequest) => api.plan(req).then((plan) => ({ req, plan })),
    onSuccess: ({ req, plan }) => setPlan(req, plan),
  });
}

/** Heatmap frames for the current plan. Fetched once; the slider is client-side. */
export function useHeatmap() {
  const plan = useTripStore((s) => s.plan);
  const request = useTripStore((s) => s.request);
  const routes = plan?.routes.map((r) => r.geometry) ?? [];
  return useQuery({
    queryKey: ["heatmap", plan?.departure_unix, request?.load_weight_lb, routes, plan?.scenario],
    queryFn: () =>
      api.heatmap({
        routes,
        departure_at: new Date(plan!.departure_unix * 1000).toISOString(),
        load_weight_lb: request!.load_weight_lb,
        scenario: plan!.scenario,
      }),
    enabled: !!plan && !!request,
    staleTime: 15 * 60_000,
    // Changing only the sample interval keeps the same routes and departure.
    placeholderData: keepPreviousData,
  });
}

export interface RouteGeometry {
  route: PlannedRoute;
  coords: LngLat[];
  miles: number[];
}

/** Decoded geometry for every route, memoised per plan. */
export function useRouteGeometries(): RouteGeometry[] {
  const plan = useTripStore((s) => s.plan);
  return useMemo(
    () =>
      plan?.routes.map((route) => {
        const coords = decodePolyline(route.geometry);
        return { route, coords, miles: cumulativeMiles(coords) };
      }) ?? [],
    [plan],
  );
}
