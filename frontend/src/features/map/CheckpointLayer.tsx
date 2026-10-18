import { useMemo } from "react";
import { Layer, Popup, Source } from "react-map-gl/maplibre";
import type { FeatureCollection, Point } from "geojson";
import type { Checkpoint } from "../../api/types";
import { formatTimeLong } from "../../lib/format";
import { RISK_COLOR, RISK_LABEL, riskColorExpression } from "../../lib/risk";
import { useTripStore } from "../../store/useTripStore";
import { RiskBadge } from "../routes/RiskBar";

/** Checkpoints of the selected route, drawn by the GPU as one circle layer. */
export function CheckpointLayer() {
  const route = useTripStore((s) => s.plan?.routes.find((r) => r.id === s.selectedRouteId));
  const focused = useTripStore((s) => s.focusedCheckpoint);

  const data = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: (route?.checkpoints ?? []).map((cp, index) => ({
        type: "Feature",
        properties: { index, level: cp.level },
        geometry: { type: "Point", coordinates: [cp.lon, cp.lat] },
      })),
    }),
    [route],
  );

  const focusedData = useMemo<FeatureCollection<Point>>(() => {
    const cp = focused !== null ? route?.checkpoints[focused] : undefined;
    return {
      type: "FeatureCollection",
      features: cp
        ? [{ type: "Feature", properties: { level: cp.level }, geometry: { type: "Point", coordinates: [cp.lon, cp.lat] } }]
        : [],
    };
  }, [route, focused]);

  return (
    <>
      <Source id="checkpoints" type="geojson" data={data}>
        <Layer
          id="checkpoints"
          type="circle"
          paint={{
            "circle-color": riskColorExpression,
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3.5, 8, 5.5, 12, 7],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
          }}
        />
      </Source>
      <Source id="checkpoint-focus" type="geojson" data={focusedData}>
        <Layer
          id="checkpoint-focus"
          type="circle"
          paint={{
            "circle-color": riskColorExpression,
            "circle-radius": 9,
            "circle-stroke-color": "#0f172a",
            "circle-stroke-width": 3,
          }}
        />
      </Source>
      <CheckpointPopup />
    </>
  );
}

function CheckpointPopup() {
  const route = useTripStore((s) => s.plan?.routes.find((r) => r.id === s.selectedRouteId));
  const index = useTripStore((s) => s.popupCheckpoint);
  const openPopup = useTripStore((s) => s.openPopup);
  const cp = index !== null ? route?.checkpoints[index] : undefined;
  if (!route || !cp) return null;

  return (
    <Popup
      longitude={cp.lon}
      latitude={cp.lat}
      anchor="bottom"
      offset={12}
      maxWidth="280px"
      onClose={() => openPopup(null)}
      closeOnClick={false}
    >
      <CheckpointDetails routeId={route.id} cp={cp} />
    </Popup>
  );
}

function CheckpointDetails({ routeId, cp }: { routeId: string; cp: Checkpoint }) {
  const w = cp.weather;
  const factors: [string, keyof Checkpoint["factors"], string][] = [
    ["Wind", "wind", `${Math.round(w.wind_mph)} mph (gusts ${Math.round(w.gust_mph)})`],
    ["Rain", "rain", `${w.rain_in_hr.toFixed(2)} in/hr`],
    ["Snow", "snow", `${w.snow_in_hr.toFixed(2)} in/hr`],
    ["Wind + load", "load", ""],
  ];
  return (
    <div className="space-y-2 text-xs text-slate-700">
      <div className="flex items-center justify-between gap-3 pr-4">
        <span className="font-semibold text-slate-900">
          Route {routeId} · mile {Math.round(cp.mile)}
        </span>
        <RiskBadge level={cp.level} />
      </div>
      <p className="text-slate-500">Truck arrives {formatTimeLong(cp.eta_unix)}</p>
      <table className="w-full">
        <tbody>
          {factors.map(([label, key, value]) => (
            <tr key={key}>
              <td className="py-0.5 text-slate-500">{label}</td>
              <td className="py-0.5 text-right tabular-nums">{value}</td>
              <td className="py-0.5 pl-2 text-right">
                <span className="font-medium" style={{ color: RISK_COLOR[cp.factors[key]] }}>
                  {RISK_LABEL[cp.factors[key]]}
                </span>
              </td>
            </tr>
          ))}
          <tr>
            <td className="py-0.5 text-slate-500">Temperature</td>
            <td className="py-0.5 text-right tabular-nums">{Math.round(w.temp_f)}°F</td>
            <td />
          </tr>
        </tbody>
      </table>
      {cp.reasons.length > 0 && (
        <p className="rounded bg-slate-50 px-2 py-1 text-slate-700">
          <span className="font-medium">Why: </span>
          {cp.reasons.join("; ")}
        </p>
      )}
      {w.beyond_forecast && <p className="text-amber-700">ETA is past the forecast range; nearest forecast used.</p>}
    </div>
  );
}
