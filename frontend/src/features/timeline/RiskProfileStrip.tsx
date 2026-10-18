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
      <div className="mb-1 flex items-baseline justify-between text-[11px] text-slate-500">
        <span className="font-medium text-slate-700">Route {route.id} risk by mile</span>
        {cp ? (
          <span>
            Mile {Math.round(cp.mile)} · {formatTime(cp.eta_unix)} ·{" "}
            <span style={{ color: RISK_COLOR[cp.level] }} className="font-semibold">
              {RISK_LABEL[cp.level]}
            </span>
          </span>
        ) : (
          <span>{Math.round(total)} mi</span>
        )}
      </div>
      <div
        ref={bar}
        className="relative h-4 cursor-crosshair overflow-hidden rounded bg-slate-100"
        onMouseMove={(e) => focusCheckpoint(nearest(e))}
        onMouseLeave={() => focusCheckpoint(null)}
        onClick={(e) => openPopup(nearest(e))}
      >
        {route.segments.map((s) => (
          <div
            key={s.from_mi}
            className="absolute inset-y-0"
            style={{
              left: `${(s.from_mi / total) * 100}%`,
              width: `${((s.to_mi - s.from_mi) / total) * 100 + 0.05}%`,
              background: RISK_COLOR[s.level],
            }}
          />
        ))}
        {cp && (
          <div className="absolute inset-y-0 w-0.5 bg-slate-900" style={{ left: `${(cp.mile / total) * 100}%` }} />
        )}
        <div
          className="absolute -top-0.5 h-5 w-1.5 -translate-x-1/2 rounded-sm border border-white bg-slate-900 shadow"
          style={{ left: `${(truckMile / total) * 100}%` }}
          title="Truck position at slider time"
        />
      </div>
    </div>
  );
}
