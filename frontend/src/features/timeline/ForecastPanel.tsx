import { CloudRain, Gauge, Pause, Play, Snowflake, Wind } from "lucide-react";
import { useEffect } from "react";
import { useHeatmap } from "../../api/hooks";
import type { HeatLayer } from "../../api/types";
import { RiskLegend, Segmented, Spinner } from "../../components/ui";
import { formatTimeLong } from "../../lib/format";
import { useTripStore } from "../../store/useTripStore";
import { RiskProfileStrip } from "./RiskProfileStrip";
import { useSliderTime } from "./useSliderTime";

const MAX_HOUR = 48;
const LAYER_OPTIONS: { value: HeatLayer | null; label: React.ReactNode; title: string }[] = [
  { value: "risk", label: <><Gauge className="h-3.5 w-3.5" />Risk</>, title: "Risk level for your load" },
  { value: "wind", label: <><Wind className="h-3.5 w-3.5" />Wind</>, title: "Sustained wind" },
  { value: "rain", label: <><CloudRain className="h-3.5 w-3.5" />Rain</>, title: "Rain rate" },
  { value: "snow", label: <><Snowflake className="h-3.5 w-3.5" />Snow</>, title: "Snow rate" },
  { value: null, label: "Off", title: "Hide the heatmap" },
];
const LAYER_HINT: Record<HeatLayer, string> = {
  risk: "Risk for your load, hour by hour",
  wind: "Wind thresholds 25 · 35 · 45 · 55 mph",
  rain: "Rain thresholds 0.10 · 0.25 · 0.50 · 1.00 in/hr",
  snow: "Snow thresholds 0.5 · 1 · 2 · 3 in/hr",
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
    <section
      aria-label="Forecast timeline"
      className="pointer-events-auto rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-float backdrop-blur-md md:p-4"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Forecast at</p>
          <p className="text-sm font-semibold tabular-nums text-slate-900" data-testid="slider-time">
            {formatTimeLong(time)}
            <span className="ml-2 rounded-md bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">+{hour}h</span>
          </p>
        </div>
        <Segmented
          label="Heatmap layer"
          size="sm"
          className="ml-auto"
          options={LAYER_OPTIONS}
          value={layer}
          onChange={setHeatLayer}
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? "Pause forecast animation" : "Play forecast animation"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm shadow-brand-600/40 transition hover:bg-brand-700"
        >
          {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
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
            className="timeline-range w-full"
            style={{ ["--p" as string]: `${(hour / MAX_HOUR) * 100}%` }}
          />
          <div className="mt-1 hidden justify-between text-[10px] font-medium text-slate-400 sm:flex">
            <span>Depart</span>
            <span>+12h</span>
            <span>+24h</span>
            <span>+36h</span>
            <span>+48h</span>
          </div>
        </div>
      </div>

      <div className="mt-2 hidden items-center justify-between gap-3 text-[11px] text-slate-500 sm:flex">
        <span className="flex items-center gap-1.5">
          {heatmap.isFetching && !heatmap.data && (
            <>
              <Spinner className="h-3 w-3 text-brand-600" />
              Loading forecast grid…
            </>
          )}
          {heatmap.isError && (
            <span className="text-red-600">
              Heatmap unavailable.{" "}
              <button type="button" className="font-medium underline" onClick={() => heatmap.refetch()}>
                Retry
              </button>
            </span>
          )}
          {heatmap.data && (layer ? LAYER_HINT[layer] : "Heatmap hidden")}
        </span>
        <RiskLegend />
      </div>

      <div className="mt-3 hidden border-t border-slate-100 pt-3 sm:block">
        <RiskProfileStrip />
      </div>
    </section>
  );
}
