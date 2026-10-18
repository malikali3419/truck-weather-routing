import { useMemo } from "react";
import { Layer, Marker, Source } from "react-map-gl/maplibre";
import type { FeatureCollection, LineString } from "geojson";
import { useRouteGeometries, type RouteGeometry } from "../../api/hooks";
import { pointAlong, sliceByMiles, type LngLat } from "../../lib/geo";
import { formatDuration } from "../../lib/format";
import { riskColorExpression } from "../../lib/risk";
import { useTripStore } from "../../store/useTripStore";

const ALT_COLOR = "#7c8db5";

/**
 * Alternatives are drawn in gray; only the selected route is colored by
 * risk, so its weather story is readable at a glance.
 */
export function RouteLayers() {
  const geometries = useRouteGeometries();
  const selectedRouteId = useTripStore((s) => s.selectedRouteId);

  const alternatives = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: "FeatureCollection",
      features: geometries
        .filter((g) => g.route.id !== selectedRouteId)
        .map(({ route, coords }) => ({
          type: "Feature",
          properties: { routeId: route.id },
          geometry: { type: "LineString", coordinates: coords },
        })),
    }),
    [geometries, selectedRouteId],
  );

  const selected = useMemo<FeatureCollection<LineString>>(() => {
    const g = geometries.find((x) => x.route.id === selectedRouteId);
    return {
      type: "FeatureCollection",
      features: g
        ? g.route.segments.map((seg) => ({
            type: "Feature" as const,
            properties: { routeId: g.route.id, level: seg.level },
            geometry: {
              type: "LineString" as const,
              coordinates: sliceByMiles(g.coords, g.miles, seg.from_mi, seg.to_mi),
            },
          }))
        : [],
    };
  }, [geometries, selectedRouteId]);

  const outline = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: "FeatureCollection",
      features: selected.features.length
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: geometries.find((x) => x.route.id === selectedRouteId)!.coords,
              },
            },
          ]
        : [],
    }),
    [geometries, selectedRouteId, selected.features.length],
  );

  return (
    <>
      <Source id="routes-alt" type="geojson" data={alternatives}>
        <Layer
          id="route-alt-casing"
          type="line"
          layout={{ "line-join": "round", "line-cap": "round" }}
          paint={{ "line-color": "#060a13", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 5, 10, 9] }}
        />
        <Layer
          id="route-alt"
          type="line"
          layout={{ "line-join": "round", "line-cap": "round" }}
          paint={{
            "line-color": ALT_COLOR,
            "line-opacity": 0.6,
            "line-dasharray": [2, 1.5],
            "line-width": ["interpolate", ["linear"], ["zoom"], 4, 2.5, 10, 5],
          }}
        />
        <Layer id="route-hit" type="line" paint={{ "line-color": "#000", "line-opacity": 0, "line-width": 18 }} />
      </Source>
      <Source id="route-outline" type="geojson" data={outline}>
        <Layer
          id="route-casing"
          type="line"
          layout={{ "line-join": "round", "line-cap": "round" }}
          paint={{ "line-color": "#060a13", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 8, 10, 13] }}
        />
      </Source>
      <Source id="route-selected" type="geojson" data={selected}>
        {/* Soft neon glow in the risk colour under the route line */}
        <Layer
          id="route-glow"
          type="line"
          layout={{ "line-join": "round", "line-cap": "round" }}
          paint={{
            "line-color": riskColorExpression,
            "line-opacity": 0.35,
            "line-blur": 8,
            "line-width": ["interpolate", ["linear"], ["zoom"], 4, 14, 10, 26],
          }}
        />
        <Layer
          id="route-line"
          type="line"
          layout={{ "line-join": "round", "line-cap": "round" }}
          paint={{
            "line-color": riskColorExpression,
            "line-width": ["interpolate", ["linear"], ["zoom"], 4, 4.5, 10, 8],
          }}
        />
      </Source>
    </>
  );
}

/** Spot on each route that is farthest from the other routes, for its label. */
function labelPoints(geometries: RouteGeometry[]): Map<string, LngLat> {
  const out = new Map<string, LngLat>();
  for (const g of geometries) {
    const others = geometries
      .filter((o) => o !== g)
      .flatMap((o) => o.coords.filter((_, i) => i % 4 === 0));
    const total = g.miles[g.miles.length - 1];
    let best: LngLat = pointAlong(g.coords, g.miles, total / 2);
    let bestScore = -1;
    for (let f = 0.25; f <= 0.75; f += 0.025) {
      const p = pointAlong(g.coords, g.miles, total * f);
      let nearest = Infinity;
      for (const q of others) {
        const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
        if (d < nearest) nearest = d;
      }
      // Prefer points away from other routes, with a mild pull to the middle.
      const score = (others.length ? nearest : 1) * (1 - Math.abs(f - 0.5));
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    out.set(g.route.id, best);
  }
  return out;
}

/** Clickable "A · 5h 29m" labels on each route, like map apps show alternatives. */
export function RouteLabels() {
  const geometries = useRouteGeometries();
  const selectedRouteId = useTripStore((s) => s.selectedRouteId);
  const recommendedId = useTripStore((s) => s.plan?.recommendation.route_id);
  const selectRoute = useTripStore((s) => s.selectRoute);
  const points = useMemo(() => labelPoints(geometries), [geometries]);

  return (
    <>
      {geometries.map(({ route }) => {
        const p = points.get(route.id);
        if (!p) return null;
        const selected = route.id === selectedRouteId;
        return (
          <Marker key={route.id} longitude={p[0]} latitude={p[1]} anchor="bottom" style={{ zIndex: selected ? 4 : 1 }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                selectRoute(route.id);
              }}
              aria-label={`Select route ${route.id} on map`}
              className={`mb-1.5 flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-semibold backdrop-blur-md transition hover:scale-105 ${
                selected
                  ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-glow"
                  : "bg-ink-850/90 text-slate-200 shadow-glass ring-1 ring-white/10 hover:ring-sky-400/40"
              }`}
            >
              <span className={`rounded px-1 ${selected ? "bg-white/20" : "bg-white/10"}`}>{route.id}</span>
              {formatDuration(route.duration_s)}
              {route.id === recommendedId && <span aria-label="recommended" className={selected ? "" : "text-emerald-300"}>★</span>}
            </button>
          </Marker>
        );
      })}
    </>
  );
}
