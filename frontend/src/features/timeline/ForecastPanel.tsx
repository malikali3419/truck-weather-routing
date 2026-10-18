import { CloudRain, Gauge, Pause, Play, Snowflake, Wind } from "lucide-react";
import { useEffect } from "react";
import { useHeatmap } from "../../api/hooks";
import type { HeatLayer } from "../../api/types";
import { RiskLegend, Segmented, Spinner } from "../../components/ui";
import { formatTimeLong } from "../../lib/format";
import { MAX_HOUR, useTripStore } from "../../store/useTripStore";
import { RiskProfileStrip } from "./RiskProfileStrip";
import { useSliderTime } from "./useSliderTime";

// Forecast hours played per real second: the full 48 h takes 24 s.
const PLAY_SPEED = 2;
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

  // Continuous playback: time advances every animation frame, so trucks drive
  // smoothly instead of jumping from hour to hour.
  useEffect(() => {
    if (!playing) return;
    if (useTripStore.getState().hour >= MAX_HOUR) setHour(0);
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // rAF timestamps can be slightly earlier than performance.now(), so never step backwards.
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
      last = now;
      const next = useTripStore.getState().hour + dt * PLAY_SPEED;
      if (next >= MAX_HOUR) {
        setHour(MAX_HOUR);
        setPlaying(false);
        return;
      }
      setHour(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, setHour, setPlaying]);

  const wholeHour = Math.floor(hour);
  const step = (delta: number) => {
    setPlaying(false);
    setHour(Math.min(MAX_HOUR, Math.max(0, wholeHour + delta)));
  };

  return (
    <section
      aria-label="Forecast timeline"
      className="pointer-events-auto rounded-2xl border border-overlay/10 bg-ink-900/80 p-3 shadow-glass backdrop-blur-xl md:p-4"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">Forecast at</p>
          <p className="text-sm font-semibold tabular-nums text-fg" data-testid="slider-time">
            {formatTimeLong(time)}
            <span className="ml-2 rounded-md bg-sky-400/15 px-1.5 py-0.5 text-xs text-sky-700 dark:text-sky-300 ring-1 ring-inset ring-sky-400/25">+{wholeHour}h</span>
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-glow transition hover:brightness-110"
        >
          {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
        </button>
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={MAX_HOUR}
            step="any"
            value={hour}
            onChange={(e) => {
              setPlaying(false);
              setHour(Math.round(Number(e.target.value)));
            }}
            onKeyDown={(e) => {
              const keys: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
              if (e.key in keys) {
                e.preventDefault();
                step(keys[e.key]);
              }
            }}
            aria-label="Forecast hour after departure"
            aria-valuetext={`${wholeHour} hours after departure, ${formatTimeLong(time)}`}
            className="timeline-range w-full"
            style={{ ["--p" as string]: `${(hour / MAX_HOUR) * 100}%` }}
          />
          <div className="mt-1.5 hidden justify-between text-[10px] font-medium text-subtle sm:flex">
            <span>Depart</span>
            <span>+12h</span>
            <span>+24h</span>
            <span>+36h</span>
            <span>+48h</span>
          </div>
        </div>
      </div>

      <div className="mt-2 hidden items-center justify-between gap-3 text-[11px] text-muted sm:flex">
        <span className="flex items-center gap-1.5">
          {heatmap.isFetching && !heatmap.data && (
            <>
              <Spinner className="h-3 w-3 text-sky-600 dark:text-sky-400" />
              Loading forecast grid…
            </>
          )}
          {heatmap.isError && (
            <span className="text-rose-600 dark:text-rose-300">
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

      <div className="mt-3 hidden border-t border-overlay/[0.06] pt-3 sm:block">
        <RiskProfileStrip />
      </div>
    </section>
  );
}
