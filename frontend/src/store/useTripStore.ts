import { create } from "zustand";
import type { HeatLayer, PlanRequest, PlanResponse } from "../api/types";

interface TripState {
  request: PlanRequest | null;
  plan: PlanResponse | null;
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
  selectedRouteId: null,
  focusedCheckpoint: null,
  popupCheckpoint: null,
  hour: 0,
  heatLayer: "risk",
  playing: false,

  setPlan: (request, plan) =>
    set((s) => ({
      request,
      plan,
      // Keep the user's route choice when only the sample interval changed.
      selectedRouteId:
        s.selectedRouteId && plan.routes.some((r) => r.id === s.selectedRouteId) &&
        s.request?.departure_at === request.departure_at
          ? s.selectedRouteId
          : (plan.recommendation.route_id ?? plan.routes[0]?.id ?? null),
      focusedCheckpoint: null,
      popupCheckpoint: null,
    })),
  selectRoute: (id) => set({ selectedRouteId: id, focusedCheckpoint: null, popupCheckpoint: null }),
  focusCheckpoint: (index) => set({ focusedCheckpoint: index }),
  openPopup: (index) => set({ popupCheckpoint: index }),
  setHour: (hour) => set({ hour }),
  setHeatLayer: (heatLayer) => set({ heatLayer }),
  setPlaying: (playing) => set({ playing }),
}));
