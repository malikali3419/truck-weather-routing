import { useMemo } from "react";
import { Layer, Popup, Source } from "react-map-gl/maplibre";
import type { FeatureCollection, Point } from "geojson";
import type { Checkpoint } from "../../api/types";
import { formatTimeLong } from "../../lib/format";
import { CloudRain, Snowflake, Thermometer, Weight, Wind } from "lucide-react";
import type { ReactNode } from "react";
import { RiskPill } from "../../components/ui";
import { RISK_COLOR, RISK_LABEL, riskColorExpression } from "../../lib/risk";
import { useTheme } from "../../store/useTheme";
import { useTripStore } from "../../store/useTripStore";

/** Checkpoints of the selected route, drawn by the GPU as one circle layer. */
export function CheckpointLayer() {
  const route = useTripStore((s) => s.plan?.routes.find((r) => r.id === s.selectedRouteId));
  const focused = useTripStore((s) => s.focusedCheckpoint);
  const stroke = useTheme((s) => s.theme) === "dark" ? "#060a13" : "#ffffff";

  const data = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: (route?.checkpoints ?? []).map((cp, index) => ({
        type: "Feature",
        properties: { index, level: cp.level, flagged: cp.level === "LOW" ? 0 : 1 },
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
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4,
              ["case", ["==", ["get", "flagged"], 1], 4, 2.5],
              10,
              ["case", ["==", ["get", "flagged"], 1], 7, 5],
            ],
            "circle-stroke-color": stroke,
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 4, 1.2, 10, 2],
          }}
        />
      </Source>
      <Source id="checkpoint-focus" type="geojson" data={focusedData}>
        <Layer
          id="checkpoint-focus-halo"
          type="circle"
          paint={{ "circle-color": riskColorExpression, "circle-opacity": 0.35, "circle-radius": 18, "circle-blur": 0.6 }}
        />
        <Layer
          id="checkpoint-focus"
          type="circle"
          paint={{
            "circle-color": riskColorExpression,
            "circle-radius": 8,
            "circle-stroke-color": "#ffffff",
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
      maxWidth="300px"
      onClose={() => openPopup(null)}
      closeOnClick={false}
    >
      <CheckpointDetails routeId={route.id} cp={cp} />
    </Popup>
  );
}

function Row({ icon, label, value, level }: { icon: ReactNode; label: string; value: string; level?: Checkpoint["level"] }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-subtle">{icon}</span>
      <span className="text-muted">{label}</span>
      <span className="ml-auto tabular-nums text-fg">{value}</span>
      {level && (
        <span className="w-16 text-right text-[11px] font-semibold" style={{ color: RISK_COLOR[level] }}>
          {RISK_LABEL[level]}
        </span>
      )}
    </div>
  );
}

function CheckpointDetails({ routeId, cp }: { routeId: string; cp: Checkpoint }) {
  const w = cp.weather;
  return (
    <div className="w-60 text-xs" data-testid="checkpoint-popup">
      <div className="flex items-start justify-between gap-3 pr-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Route {routeId} · mile {Math.round(cp.mile)}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-fg">{formatTimeLong(cp.eta_unix)}</p>
        </div>
      </div>
      <div className="mt-2">
        <RiskPill level={cp.level} />
      </div>
      <div className="mt-2 divide-y divide-overlay/[0.06]">
        <Row icon={<Wind className="h-3.5 w-3.5" />} label="Wind" value={`${Math.round(w.wind_mph)} mph`} level={cp.factors.wind} />
        <Row icon={<CloudRain className="h-3.5 w-3.5" />} label="Rain" value={`${w.rain_in_hr.toFixed(2)} in/hr`} level={cp.factors.rain} />
        <Row icon={<Snowflake className="h-3.5 w-3.5" />} label="Snow" value={`${w.snow_in_hr.toFixed(2)} in/hr`} level={cp.factors.snow} />
        <Row icon={<Weight className="h-3.5 w-3.5" />} label="Wind + load" value="" level={cp.factors.load} />
        <Row
          icon={<Thermometer className="h-3.5 w-3.5" />}
          label="Temp · gusts"
          value={`${Math.round(w.temp_f)}°F · ${Math.round(w.gust_mph)} mph`}
        />
      </div>
      {cp.reasons.length > 0 && (
        <p className="mt-2 rounded-lg border border-overlay/[0.06] bg-overlay/[0.04] px-2.5 py-1.5 leading-relaxed text-fg-2">
          <span className="font-semibold text-fg">Why: </span>
          {cp.reasons.join("; ")}
        </p>
      )}
      {w.beyond_forecast && <p className="mt-2 text-amber-700 dark:text-amber-300">ETA is past the forecast range; nearest forecast used.</p>}
    </div>
  );
}
