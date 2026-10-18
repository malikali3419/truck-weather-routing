import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import type { FeatureCollection, Point } from "geojson";
import { useHeatmap } from "../../api/hooks";
import type { HeatLayer } from "../../api/types";
import { RISK_COLOR } from "../../lib/risk";
import { useTripStore } from "../../store/useTripStore";

const CALM = "#38bdf8";

/** Color and opacity per layer. Breakpoints match the risk table. */
export const HEAT_STYLES: Record<HeatLayer, { color: unknown; opacity: unknown }> = {
  risk: {
    color: ["match", ["get", "v"], 0, RISK_COLOR.LOW, 1, RISK_COLOR.MODERATE, 2, RISK_COLOR.HIGH, 3, RISK_COLOR.SEVERE, RISK_COLOR.NO_TRAVEL],
    opacity: ["case", ["==", ["get", "v"], 0], 0.07, 0.5],
  },
  wind: {
    color: ["step", ["get", "v"], CALM, 25, RISK_COLOR.MODERATE, 35, RISK_COLOR.HIGH, 45, RISK_COLOR.SEVERE, 55, RISK_COLOR.NO_TRAVEL],
    opacity: ["interpolate", ["linear"], ["get", "v"], 0, 0.04, 15, 0.3, 25, 0.6],
  },
  rain: {
    color: ["step", ["get", "v"], CALM, 0.1, RISK_COLOR.MODERATE, 0.25, RISK_COLOR.HIGH, 0.5, RISK_COLOR.SEVERE, 1.0001, RISK_COLOR.NO_TRAVEL],
    opacity: ["interpolate", ["linear"], ["get", "v"], 0, 0, 0.01, 0.35, 0.1, 0.6],
  },
  snow: {
    color: ["step", ["get", "v"], "#a5b4fc", 0.5, RISK_COLOR.MODERATE, 1, RISK_COLOR.HIGH, 2, RISK_COLOR.SEVERE, 3.0001, RISK_COLOR.NO_TRAVEL],
    opacity: ["interpolate", ["linear"], ["get", "v"], 0, 0, 0.01, 0.4, 0.5, 0.65],
  },
};

/**
 * Blurred grid circles colored by the value at the slider hour.
 *
 * All 49 hourly frames are already in memory, so moving the slider only
 * swaps one number per point; there is no network request.
 */
export function HeatmapLayer({ beforeId }: { beforeId?: string }) {
  const { data } = useHeatmap();
  // Forecast data is hourly, so the heatmap only changes on whole hours.
  const hour = useTripStore((s) => Math.floor(s.hour));
  const layer = useTripStore((s) => s.heatLayer);

  const geojson = useMemo<FeatureCollection<Point>>(() => {
    if (!data || !layer) return { type: "FeatureCollection", features: [] };
    const frame = data.layers[layer][Math.min(hour, data.times_unix.length - 1)];
    return {
      type: "FeatureCollection",
      features: data.points.map(([lat, lon], i) => ({
        type: "Feature",
        properties: { v: frame[i] },
        geometry: { type: "Point", coordinates: [lon, lat] },
      })),
    };
  }, [data, hour, layer]);

  // Circle radius that covers one grid cell at every zoom level. Latitude
  // spacing is stretched ~1.3x by Web Mercator at US latitudes, so circles
  // must be a bit larger than half a cell for neighbours to blend.
  const step = data?.grid_step_deg ?? 0.25;
  const r0 = ((step * 512) / 360) * 1.6;
  const style = HEAT_STYLES[layer ?? "risk"];

  return (
    <Source id="heatmap" type="geojson" data={geojson}>
      <Layer
        id="heatmap"
        type="circle"
        beforeId={beforeId}
        paint={{
          "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 0, r0, 16, r0 * 2 ** 16],
          "circle-color": style.color as string,
          "circle-opacity": style.opacity as number,
          "circle-blur": 1,
        }}
      />
    </Source>
  );
}
