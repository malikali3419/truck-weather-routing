import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import type { FeatureCollection, LineString } from "geojson";
import { useRouteGeometries } from "../../api/hooks";
import { sliceByMiles } from "../../lib/geo";
import { riskColorExpression } from "../../lib/risk";
import { useTripStore } from "../../store/useTripStore";

/** Every route drawn as risk-colored segments; the selected one on top. */
export function RouteLayers() {
  const geometries = useRouteGeometries();
  const selectedRouteId = useTripStore((s) => s.selectedRouteId);

  const data = useMemo<FeatureCollection<LineString>>(() => {
    const features = geometries.flatMap(({ route, coords, miles }) =>
      route.segments.map((seg) => ({
        type: "Feature" as const,
        properties: {
          routeId: route.id,
          level: seg.level,
          selected: route.id === selectedRouteId ? 1 : 0,
        },
        geometry: { type: "LineString" as const, coordinates: sliceByMiles(coords, miles, seg.from_mi, seg.to_mi) },
      })),
    );
    return { type: "FeatureCollection", features };
  }, [geometries, selectedRouteId]);

  return (
    <Source id="routes" type="geojson" data={data}>
      <Layer
        id="route-casing"
        type="line"
        layout={{ "line-join": "round", "line-cap": "round", "line-sort-key": ["get", "selected"] }}
        paint={{
          "line-color": ["case", ["==", ["get", "selected"], 1], "#0f172a", "#ffffff"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, ["case", ["==", ["get", "selected"], 1], 7, 4], 10, ["case", ["==", ["get", "selected"], 1], 12, 7]],
          "line-opacity": ["case", ["==", ["get", "selected"], 1], 0.9, 0.8],
        }}
      />
      <Layer
        id="route-line"
        type="line"
        layout={{ "line-join": "round", "line-cap": "round", "line-sort-key": ["get", "selected"] }}
        paint={{
          "line-color": riskColorExpression,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, ["case", ["==", ["get", "selected"], 1], 4, 2], 10, ["case", ["==", ["get", "selected"], 1], 8, 4]],
          "line-opacity": ["case", ["==", ["get", "selected"], 1], 1, 0.45],
        }}
      />
      {/* Wide invisible line so routes are easy to click. */}
      <Layer id="route-hit" type="line" paint={{ "line-color": "#000", "line-opacity": 0, "line-width": 16 }} />
    </Source>
  );
}
