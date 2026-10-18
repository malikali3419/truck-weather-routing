import { useState } from "react";
import { formatTime } from "../../lib/format";
import { RISK_COLOR, RISK_LABEL } from "../../lib/risk";
import { useTripStore } from "../../store/useTripStore";

export function CheckpointTable() {
  const route = useTripStore((s) => s.plan?.routes.find((r) => r.id === s.selectedRouteId));
  const focused = useTripStore((s) => s.focusedCheckpoint);
  const focusCheckpoint = useTripStore((s) => s.focusCheckpoint);
  const openPopup = useTripStore((s) => s.openPopup);
  const [open, setOpen] = useState(false);
  if (!route) return null;

  const flagged = route.checkpoints.filter((c) => c.level !== "LOW").length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-800"
      >
        <span>
          Route {route.id} checkpoints
          <span className="ml-1.5 font-normal text-slate-500">
            {route.checkpoints.length} · {flagged} above low
          </span>
        </span>
        <span aria-hidden className={`transition ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div className="max-h-80 overflow-auto border-t border-slate-100">
          <table className="w-full whitespace-nowrap text-xs">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-1.5 font-medium">Mile</th>
                <th className="px-2 py-1.5 font-medium">ETA</th>
                <th className="px-2 py-1.5 text-right font-medium">Wind</th>
                <th className="px-2 py-1.5 text-right font-medium">Rain</th>
                <th className="px-2 py-1.5 text-right font-medium">Snow</th>
                <th className="px-3 py-1.5 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {route.checkpoints.map((cp, i) => (
                <tr
                  key={cp.mile}
                  tabIndex={0}
                  onMouseEnter={() => focusCheckpoint(i)}
                  onMouseLeave={() => focusCheckpoint(null)}
                  onFocus={() => focusCheckpoint(i)}
                  onClick={() => openPopup(i)}
                  onKeyDown={(e) => e.key === "Enter" && openPopup(i)}
                  className={`cursor-pointer border-t border-slate-100 ${focused === i ? "bg-slate-100" : "hover:bg-slate-50"}`}
                >
                  <td className="px-3 py-1.5 tabular-nums">{Math.round(cp.mile)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{formatTime(cp.eta_unix)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{Math.round(cp.weather.wind_mph)} mph</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{cp.weather.rain_in_hr.toFixed(2)}″</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{cp.weather.snow_in_hr.toFixed(2)}″</td>
                  <td className="px-3 py-1.5">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ background: RISK_COLOR[cp.level] }} />
                      {RISK_LABEL[cp.level]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
