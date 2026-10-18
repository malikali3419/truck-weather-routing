import { ChevronDown, MapPinned } from "lucide-react";
import { useState } from "react";
import { RiskPill, Segmented } from "../../components/ui";
import { formatTime } from "../../lib/format";
import { useTripStore } from "../../store/useTripStore";

type Filter = "all" | "flagged";

export function CheckpointTable() {
  const route = useTripStore((s) => s.plan?.routes.find((r) => r.id === s.selectedRouteId));
  const focused = useTripStore((s) => s.focusedCheckpoint);
  const focusCheckpoint = useTripStore((s) => s.focusCheckpoint);
  const openPopup = useTripStore((s) => s.openPopup);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  if (!route) return null;

  const rows = route.checkpoints
    .map((cp, index) => ({ cp, index }))
    .filter(({ cp }) => filter === "all" || cp.level !== "LOW");
  const flagged = route.checkpoints.filter((c) => c.level !== "LOW").length;

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <MapPinned className="h-4 w-4" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-slate-900">Route {route.id} checkpoints</span>
          <span className="block text-xs text-slate-500">
            {route.checkpoints.length} weather checks · {flagged} above low
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-slate-100">
          <div className="px-4 py-2">
            <Segmented<Filter>
              label="Checkpoint filter"
              size="sm"
              options={[
                { value: "all", label: `All (${route.checkpoints.length})` },
                { value: "flagged", label: `Above low (${flagged})` },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </div>
          <div className="scrollbar-thin max-h-80 overflow-auto">
            <table className="w-full whitespace-nowrap text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Mile</th>
                  <th className="px-2 py-2 font-semibold">ETA</th>
                  <th className="px-2 py-2 text-right font-semibold">Wind</th>
                  <th className="px-2 py-2 text-right font-semibold">Rain</th>
                  <th className="px-2 py-2 text-right font-semibold">Snow</th>
                  <th className="px-4 py-2 font-semibold">Risk</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ cp, index }) => (
                  <tr
                    key={cp.mile}
                    tabIndex={0}
                    onMouseEnter={() => focusCheckpoint(index)}
                    onMouseLeave={() => focusCheckpoint(null)}
                    onFocus={() => focusCheckpoint(index)}
                    onClick={() => openPopup(index)}
                    onKeyDown={(e) => e.key === "Enter" && openPopup(index)}
                    className={`cursor-pointer border-t border-slate-100 tabular-nums outline-none transition ${
                      focused === index ? "bg-brand-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-2 font-medium text-slate-800">{Math.round(cp.mile)}</td>
                    <td className="px-2 py-2 text-slate-600">{formatTime(cp.eta_unix)}</td>
                    <td className="px-2 py-2 text-right">{Math.round(cp.weather.wind_mph)} mph</td>
                    <td className="px-2 py-2 text-right">{cp.weather.rain_in_hr.toFixed(2)}″</td>
                    <td className="px-2 py-2 text-right">{cp.weather.snow_in_hr.toFixed(2)}″</td>
                    <td className="px-4 py-2">
                      <RiskPill level={cp.level} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      Every checkpoint on this route is low risk.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
