import { useMemo, useRef, type MouseEvent } from "react";
import { formatTime } from "../../lib/format";
import { RISK_COLOR, RISK_LABEL } from "../../lib/risk";
import { useTripStore } from "../../store/useTripStore";
import { useSliderTime } from "./useSliderTime";

/** The selected route laid out by mile, colored by risk. Hover to find a checkpoint. */
export function RiskProfileStrip() {
  const route = useTripStore((s) => s.plan?.routes.find((r) => r.id === s.selectedRouteId));
  const departure = useTripStore((s) => s.plan?.departure_unix ?? 0);
  const focused = useTripStore((s) => s.focusedCheckpoint);
  const focusCheckpoint = useTripStore((s) => s.focusCheckpoint);
  const openPopup = useTripStore((s) => s.openPopup);
  const time = useSliderTime();
  const bar = useRef<HTMLDivElement>(null);

  const total = route?.distance_mi || 1;
  const cps = route?.checkpoints ?? [];

  // Mile the truck has reached at the slider time, from checkpoint ETAs.
  const truckMile = useMemo(() => {
    if (!cps.length) return 0;
    if (time <= departure) return 0;
    const i = cps.findIndex((c) => c.eta_unix >= time);
    if (i === -1) return cps[cps.length - 1].mile;
    if (i === 0) return 0;
    const a = cps[i - 1];
    const b = cps[i];
    const t = (time - a.eta_unix) / Math.max(1, b.eta_unix - a.eta_unix);
    return a.mile + (b.mile - a.mile) * t;
  }, [cps, time, departure]);

  if (!route) return null;

  const nearest = (e: MouseEvent<HTMLDivElement>) => {
    const rect = bar.current!.getBoundingClientRect();
    const mile = ((e.clientX - rect.left) / rect.width) * total;
    let best = 0;
    cps.forEach((c, i) => {
      if (Math.abs(c.mile - mile) < Math.abs(cps[best].mile - mile)) best = i;
    });
    return best;
  };

  const cp = focused !== null ? cps[focused] : undefined;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[11px] text-slate-400">
        <span className="font-semibold text-slate-200">Route {route.id} along the way</span>
        {cp ? (
          <span>
            Mile {Math.round(cp.mile)} · {formatTime(cp.eta_unix)} ·{" "}
            <span style={{ color: RISK_COLOR[cp.level] }} className="font-semibold">
              {RISK_LABEL[cp.level]}
            </span>
          </span>
        ) : (
          <span>Hover to inspect · dot = truck at slider time</span>
        )}
      </div>
      <div
        ref={bar}
        className="relative h-3 cursor-crosshair rounded-full bg-white/[0.06]"
        data-testid="risk-strip"
        onMouseMove={(e) => focusCheckpoint(nearest(e))}
        onMouseLeave={() => focusCheckpoint(null)}
        onClick={(e) => openPopup(nearest(e))}
      >
        {route.segments.map((s) => (
          <div
            key={s.from_mi}
            className="absolute inset-y-0 first:rounded-l-full"
            style={{
              left: `${(s.from_mi / total) * 100}%`,
              width: `${((s.to_mi - s.from_mi) / total) * 100 + 0.05}%`,
              background: RISK_COLOR[s.level],
            }}
          />
        ))}
        {cp && (
          <div className="absolute -inset-y-1 w-0.5 rounded bg-white" style={{ left: `${(cp.mile / total) * 100}%` }} />
        )}
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-indigo-500 shadow-[0_0_0_4px_rgba(99,102,241,0.3),0_4px_12px_rgba(0,0,0,0.6)]"
          style={{ left: `${(truckMile / total) * 100}%` }}
          title="Truck position at slider time"
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-slate-500">
        <span>0 mi</span>
        <span>{Math.round(total / 2)} mi</span>
        <span>{Math.round(total)} mi</span>
      </div>
    </div>
  );
}
