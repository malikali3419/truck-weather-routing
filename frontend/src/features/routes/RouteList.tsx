import type { PlannedRoute } from "../../api/types";
import { formatDuration, formatMiles, formatTime } from "../../lib/format";
import { LEVELS, RISK_COLOR, RISK_LABEL } from "../../lib/risk";
import { useTripStore } from "../../store/useTripStore";
import { RiskBadge, RiskBar } from "./RiskBar";

export function RecommendationBanner() {
  const rec = useTripStore((s) => s.plan?.recommendation);
  if (!rec) return null;

  if (!rec.route_id) {
    return (
      <div role="alert" className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900">
        <p className="font-semibold">No safe route at this departure time</p>
        <p className="mt-1 text-purple-800">{rec.warning}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
      <p className="font-semibold text-emerald-900">
        <span aria-hidden>★ </span>Route {rec.route_id} is recommended
      </p>
      {rec.reasons.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-emerald-800">
          {rec.reasons.map((r) => (
            <li key={r} className="flex gap-1.5">
              <span aria-hidden>·</span>
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RouteCard({ route, recommended, selected }: { route: PlannedRoute; recommended: boolean; selected: boolean }) {
  const selectRoute = useTripStore((s) => s.selectRoute);
  const s = route.summary;
  return (
    <button
      type="button"
      onClick={() => selectRoute(route.id)}
      aria-pressed={selected}
      className={`w-full rounded-xl border p-3 text-left transition ${
        selected ? "border-slate-900 bg-white shadow-md ring-1 ring-slate-900" : "border-slate-200 bg-white hover:border-slate-400"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
            selected ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          {route.id}
        </span>
        <span className="font-semibold text-slate-900">{formatDuration(route.duration_s)}</span>
        <span className="text-sm text-slate-500">{formatMiles(route.distance_mi)}</span>
        <span className="ml-auto flex gap-1">
          {recommended && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              ★ Best
            </span>
          )}
          {s.has_no_travel && <RiskBadge level="NO_TRAVEL" />}
        </span>
      </div>

      <div className="mt-2.5">
        <RiskBar miles={s.miles_by_level} />
      </div>

      <dl className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-slate-500">Arrives</dt>
          <dd className="font-medium text-slate-800">{formatTime(route.arrival_unix)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Severe / high</dt>
          <dd className="font-medium text-slate-800">
            {Math.round(s.miles_by_level.SEVERE)} / {Math.round(s.miles_by_level.HIGH)} mi
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Avg risk</dt>
          <dd className="font-medium text-slate-800">{s.avg_risk.toFixed(2)} / 4</dd>
        </div>
      </dl>

      {route.extra_duration_s > 60 && (
        <p className="mt-2 text-xs text-slate-500">+{formatDuration(route.extra_duration_s)} vs fastest</p>
      )}
      {s.beyond_forecast && (
        <p className="mt-1 text-xs text-amber-700">Part of this trip is past the forecast range.</p>
      )}
    </button>
  );
}

export function RouteList() {
  const plan = useTripStore((s) => s.plan);
  const selectedRouteId = useTripStore((s) => s.selectedRouteId);
  if (!plan) return null;
  return (
    <div className="space-y-2">
      {plan.routes.map((r) => (
        <RouteCard
          key={r.id}
          route={r}
          recommended={plan.recommendation.route_id === r.id}
          selected={selectedRouteId === r.id}
        />
      ))}
    </div>
  );
}

export function RiskLegend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
      {LEVELS.map((l) => (
        <li key={l} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLOR[l] }} />
          {RISK_LABEL[l]}
        </li>
      ))}
    </ul>
  );
}
