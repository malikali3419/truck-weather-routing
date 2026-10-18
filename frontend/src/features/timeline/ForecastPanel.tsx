import { useEffect } from "react";
import { useHeatmap } from "../../api/hooks";
import type { HeatLayer } from "../../api/types";
import { formatTimeLong } from "../../lib/format";
import { useTripStore } from "../../store/useTripStore";
import { RiskLegend } from "../routes/RouteList";
import { RiskProfileStrip } from "./RiskProfileStrip";
import { useSliderTime } from "./useSliderTime";

const MAX_HOUR = 48;
const LAYERS: { id: HeatLayer | null; label: string }[] = [
  { id: "risk", label: "Risk" },
  { id: "wind", label: "Wind" },
  { id: "rain", label: "Rain" },
  { id: "snow", label: "Snow" },
  { id: null, label: "Off" },
];
const LAYER_HINT: Record<HeatLayer, string> = {
  risk: "Risk level for your load at each hour",
  wind: "Sustained wind, mph: 25 / 35 / 45 / 55",
  rain: "Rain, in/hr: 0.10 / 0.25 / 0.50 / 1.00",
  snow: "Snow, in/hr: 0.5 / 1 / 2 / 3",
};

export function ForecastPanel() {
  const hour = useTripStore((s) => s.hour);
  const setHour = useTripStore((s) => s.setHour);
  const layer = useTripStore((s) => s.heatLayer);
  const setHeatLayer = useTripStore((s) => s.setHeatLayer);
  const playing = useTripStore((s) => s.playing);
  const setPlaying = useTripStore((s) => s.setPlaying);
  const heatmap = useHeatmap();
  const time = useSliderTime();

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const next = useTripStore.getState().hour + 1;
      setHour(next > MAX_HOUR ? 0 : next);
    }, 450);
    return () => window.clearInterval(id);
  }, [playing, setHour]);

  return (
    <div className="pointer-events-auto rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-xl backdrop-blur md:p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1" role="radiogroup" aria-label="Heatmap layer">
          {LAYERS.map((l) => (
            <button
              key={l.label}
              type="button"
              role="radio"
              aria-checked={layer === l.id}
              onClick={() => setHeatLayer(l.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                layer === l.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="hidden text-xs text-slate-500 sm:block">
          {heatmap.isFetching && !heatmap.data && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              Loading forecast grid…
            </span>
          )}
          {heatmap.isError && (
            <span className="text-red-600">
              Heatmap unavailable.{" "}
              <button type="button" className="underline" onClick={() => heatmap.refetch()}>
                Retry
              </button>
            </span>
          )}
          {heatmap.data && layer && LAYER_HINT[layer]}
        </div>
        <div className="ml-auto hidden md:block">
          <RiskLegend />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? "Pause forecast animation" : "Play forecast animation"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-700"
        >
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <rect x="2" y="1" width="3" height="10" fill="currentColor" />
              <rect x="7" y="1" width="3" height="10" fill="currentColor" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path d="M3 1l8 5-8 5z" fill="currentColor" />
            </svg>
          )}
        </button>
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={MAX_HOUR}
            step={1}
            value={hour}
            onChange={(e) => {
              setPlaying(false);
              setHour(Number(e.target.value));
            }}
            aria-label="Forecast hour after departure"
            aria-valuetext={`${hour} hours after departure, ${formatTimeLong(time)}`}
            className="w-full accent-slate-900"
          />
          <div className="hidden justify-between text-[10px] text-slate-400 sm:flex">
            <span>Departure</span>
            <span>+12h</span>
            <span>+24h</span>
            <span>+36h</span>
            <span>+48h</span>
          </div>
        </div>
        <div className="w-28 shrink-0 text-right sm:w-36">
          <div className="text-sm font-semibold tabular-nums text-slate-900">+{hour}h</div>
          <div className="text-[11px] text-slate-500">{formatTimeLong(time)}</div>
        </div>
      </div>

      <div className="mt-3 hidden sm:block">
        <RiskProfileStrip />
      </div>
    </div>
  );
}
