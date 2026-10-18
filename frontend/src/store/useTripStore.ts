import { create } from "zustand";
import type { HeatLayer, PlanRequest, PlanResponse } from "../api/types";

export const MAX_HOUR = 48;

interface TripState {
  request: PlanRequest | null;
  plan: PlanResponse | null;
  planError: string | null;
  /** The trip form is expanded (always true before the first plan). */
  formOpen: boolean;
  selectedRouteId: string | null;
  /** Checkpoint index on the selected route that is hovered or focused. */
  focusedCheckpoint: number | null;
  /** Popup target: checkpoint index on the selected route. */
  popupCheckpoint: number | null;
  /** Forecast slider position, hours after the departure hour (0–48). */
  hour: number;
  heatLayer: HeatLayer | null;
  playing: boolean;

  setPlan: (request: PlanRequest, plan: PlanResponse) => void;
  setPlanError: (message: string | null) => void;
  setFormOpen: (open: boolean) => void;
  selectRoute: (id: string) => void;
  focusCheckpoint: (index: number | null) => void;
  openPopup: (index: number | null) => void;
  setHour: (hour: number) => void;
  setHeatLayer: (layer: HeatLayer | null) => void;
  setPlaying: (playing: boolean) => void;
}

export const useTripStore = create<TripState>((set) => ({
  request: null,
  plan: null,
  planError: null,
  formOpen: true,
  selectedRouteId: null,
  focusedCheckpoint: null,
  popupCheckpoint: null,
  hour: 0,
  heatLayer: "risk",
  playing: false,

  setPlan: (request, plan) =>
    set((s) => {
      // Same trip with a new sample interval: keep the route the user picked.
      const sameTrip =
        s.request?.departure_at === request.departure_at &&
        s.request?.origin.label === request.origin.label &&
        s.request?.destination.label === request.destination.label;
      const keepSelection = sameTrip && plan.routes.some((r) => r.id === s.selectedRouteId);
      return {
        request,
        plan,
        planError: null,
        formOpen: false,
        selectedRouteId: keepSelection
          ? s.selectedRouteId
          : (plan.recommendation.route_id ?? plan.routes[0]?.id ?? null),
        hour: sameTrip ? s.hour : 0,
        focusedCheckpoint: null,
        popupCheckpoint: null,
      };
    }),
  setPlanError: (planError) => set({ planError }),
  setFormOpen: (formOpen) => set({ formOpen }),
  selectRoute: (id) => set({ selectedRouteId: id, focusedCheckpoint: null, popupCheckpoint: null }),
  focusCheckpoint: (index) => set({ focusedCheckpoint: index }),
  openPopup: (index) => set({ popupCheckpoint: index }),
  // Always within the 0–48 h forecast window, whoever sets it.
  setHour: (hour) => set({ hour: Number.isFinite(hour) ? Math.min(MAX_HOUR, Math.max(0, hour)) : 0 }),
  setHeatLayer: (heatLayer) => set({ heatLayer }),
  setPlaying: (playing) => set({ playing }),
}));
