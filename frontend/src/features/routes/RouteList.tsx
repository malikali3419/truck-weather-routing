import { ChevronDown, OctagonAlert, ShieldCheck, Star, Zap } from "lucide-react";
import { useState } from "react";
import type { PlannedRoute } from "../../api/types";
import { RiskPill, RiskRibbon, Skeleton } from "../../components/ui";
import { formatDuration, formatMiles, formatTime } from "../../lib/format";
import { useTripStore } from "../../store/useTripStore";

export function RecommendationCard() {
  const plan = useTripStore((s) => s.plan);
  const selectRoute = useTripStore((s) => s.selectRoute);
  const [open, setOpen] = useState(true);
  if (!plan) return null;
  const rec = plan.recommendation;

  if (!rec.route_id) {
    return (
      <section role="alert" className="card overflow-hidden border-purple-400/25">
        <div className="flex gap-3 bg-gradient-to-br from-purple-500/15 to-transparent p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-400/15 text-purple-700 dark:text-purple-300 ring-1 ring-inset ring-purple-400/30">
            <OctagonAlert className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-purple-900 dark:text-purple-100">No safe route at this departure time</p>
            <p className="mt-0.5 text-sm text-purple-800 dark:text-purple-200/80">{rec.warning}</p>
          </div>
        </div>
      </section>
    );
  }

  const route = plan.routes.find((r) => r.id === rec.route_id)!;
  return (
    <section className="card overflow-hidden border-emerald-400/25 shadow-glow-emerald" aria-label="Recommendation">
      <div className="bg-gradient-to-br from-emerald-400/[0.14] via-emerald-400/[0.03] to-transparent p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-glow-emerald">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">Recommended</p>
            <button
              type="button"
              onClick={() => selectRoute(route.id)}
              className="text-left text-base font-semibold text-fg hover:underline"
            >
              Route {route.id} · {formatDuration(route.duration_s)}
            </button>
            <p className="text-xs text-muted">
              {Math.round(route.summary.miles_by_level.SEVERE)} severe mi ·{" "}
              {Math.round(route.summary.miles_by_level.HIGH)} high mi · arrives {formatTime(route.arrival_unix)}
            </p>
          </div>
        </div>
        {rec.reasons.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
            >
              Why this route
              <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <ul className="mt-1.5 space-y-1 text-[13px] text-fg-2">
                {rec.reasons.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function RouteCard({
  route,
  recommended,
  fastest,
  selected,
}: {
  route: PlannedRoute;
  recommended: boolean;
  fastest: boolean;
  selected: boolean;
}) {
  const selectRoute = useTripStore((s) => s.selectRoute);
  const s = route.summary;
  return (
    <button
      type="button"
      onClick={() => selectRoute(route.id)}
      aria-pressed={selected}
      aria-label={`Route ${route.id}, ${formatDuration(route.duration_s)}, ${formatMiles(route.distance_mi)}`}
      className={`group w-full rounded-2xl border p-4 text-left backdrop-blur-xl transition ${
        selected
          ? "border-sky-400/40 bg-gradient-to-br from-sky-400/[0.1] to-indigo-500/[0.05] shadow-glow"
          : "border-overlay/[0.07] bg-overlay/[0.03] hover:border-overlay/15 hover:bg-overlay/[0.05]"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition ${
            selected ? "bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-glow" : "bg-overlay/[0.07] text-fg-2 group-hover:bg-overlay/10"
          }`}
        >
          {route.id}
        </span>
        <div className="min-w-0">
          <span className="text-[15px] font-semibold tabular-nums text-fg">{formatDuration(route.duration_s)}</span>
          <span className="ml-2 text-xs tabular-nums text-muted">{formatMiles(route.distance_mi)}</span>
        </div>
        <div className="ml-auto flex shrink-0 gap-1">
          {recommended && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
              <Star className="h-3 w-3 fill-current" />
              Best
            </span>
          )}
          {fastest && !recommended && (
            <span className="inline-flex items-center gap-1 rounded-full bg-overlay/[0.06] px-2 py-0.5 text-[11px] font-semibold text-fg-2 ring-1 ring-inset ring-overlay/10">
              <Zap className="h-3 w-3" />
              Fastest
            </span>
          )}
          {s.has_no_travel && <RiskPill level="NO_TRAVEL" />}
        </div>
      </div>

      <div className="mt-3">
        <RiskRibbon segments={route.segments} total={route.distance_mi} />
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-2">
        <div>
          <dt className="stat-label">Arrive</dt>
          <dd className="mt-0.5 text-xs font-medium tabular-nums text-fg">{formatTime(route.arrival_unix)}</dd>
        </div>
        <div>
          <dt className="stat-label">Severe</dt>
          <dd className="mt-0.5 text-xs font-medium tabular-nums text-fg">{Math.round(s.miles_by_level.SEVERE)} mi</dd>
        </div>
        <div>
          <dt className="stat-label">High</dt>
          <dd className="mt-0.5 text-xs font-medium tabular-nums text-fg">{Math.round(s.miles_by_level.HIGH)} mi</dd>
        </div>
        <div>
          <dt className="stat-label">Avg risk</dt>
          <dd className="mt-0.5 text-xs font-medium tabular-nums text-fg">{s.avg_risk.toFixed(2)}</dd>
        </div>
      </dl>

      {(route.extra_duration_s > 60 || s.beyond_forecast) && (
        <div className="mt-3 flex flex-wrap gap-x-3 border-t border-overlay/[0.06] pt-2 text-[11px] text-muted">
          {route.extra_duration_s > 60 && <span>+{formatDuration(route.extra_duration_s)} vs fastest</span>}
          {s.beyond_forecast && <span className="text-amber-700 dark:text-amber-300">Part of the trip is past the forecast range</span>}
        </div>
      )}
    </button>
  );
}

export function RouteList() {
  const plan = useTripStore((s) => s.plan);
  const selectedRouteId = useTripStore((s) => s.selectedRouteId);
  if (!plan) return null;
  const fastestId = plan.routes.reduce((a, b) => (b.duration_s < a.duration_s ? b : a)).id;
  return (
    <section aria-label="Route options">
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {plan.routes.length} route options
      </h2>
      <div className="space-y-2.5">
        {plan.routes.map((r) => (
          <RouteCard
            key={r.id}
            route={r}
            recommended={plan.recommendation.route_id === r.id}
            fastest={r.id === fastestId}
            selected={selectedRouteId === r.id}
          />
        ))}
      </div>
    </section>
  );
}

export function ResultsSkeleton() {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Loading routes">
      <Skeleton className="h-28 rounded-2xl" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="card space-y-3 p-4">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-7" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-12" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-6" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
