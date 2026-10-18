import { CalendarClock, CloudLightning, Pencil, Weight } from "lucide-react";
import { usePlanning, usePlanTrip } from "../../api/hooks";
import { Segmented, Spinner } from "../../components/ui";
import { formatTimeLong } from "../../lib/format";
import { useTripStore } from "../../store/useTripStore";
import { INTERVAL_OPTIONS } from "./TripForm";

function shortName(label: string): string {
  return label.split(",")[0];
}

/** Compact view of the planned trip, shown once the form collapses. */
export function TripSummary() {
  const request = useTripStore((s) => s.request);
  const plan = useTripStore((s) => s.plan);
  const planError = useTripStore((s) => s.planError);
  const setFormOpen = useTripStore((s) => s.setFormOpen);
  const planTrip = usePlanTrip();
  const planning = usePlanning();
  if (!request || !plan) return null;

  return (
    <section className="card p-4" aria-label="Current trip">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center pt-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-[2.5px] border-slate-200" />
          <span className="my-0.5 h-5 border-l-2 border-dotted border-slate-600" />
          <span className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white" title={request.origin.label}>
            {shortName(request.origin.label)}
          </p>
          <p className="mt-3 truncate text-sm font-semibold text-white" title={request.destination.label}>
            {shortName(request.destination.label)}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => setFormOpen(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Edit trip
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" />
          {formatTimeLong(plan.departure_unix)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Weight className="h-3.5 w-3.5" />
          {request.load_weight_lb.toLocaleString()} lb
        </span>
        {plan.scenario && (
          <span className="inline-flex items-center gap-1.5 font-medium text-amber-300">
            <CloudLightning className="h-3.5 w-3.5" />
            Simulated storm
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-white/[0.06] pt-3">
        <span className="shrink-0 text-xs font-medium text-slate-500">Check every</span>
        <Segmented
          label="Check weather every"
          size="sm"
          className="flex-1"
          options={INTERVAL_OPTIONS}
          value={request.sample_interval_mi}
          onChange={(value) => planTrip.mutate({ ...request, sample_interval_mi: value })}
        />
        {planning && <Spinner className="h-3.5 w-3.5 text-sky-400" />}
      </div>
      {planError && (
        <p role="alert" className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200">
          {planError}
        </p>
      )}
    </section>
  );
}
