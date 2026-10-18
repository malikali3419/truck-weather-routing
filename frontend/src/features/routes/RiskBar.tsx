import type { RiskLevel } from "../../api/types";
import { LEVELS, RISK_COLOR, RISK_LABEL } from "../../lib/risk";

/** Stacked bar: share of the route's miles at each risk level. */
export function RiskBar({ miles }: { miles: Record<RiskLevel, number> }) {
  const total = LEVELS.reduce((sum, l) => sum + miles[l], 0) || 1;
  const label = LEVELS.filter((l) => miles[l] > 0)
    .map((l) => `${RISK_LABEL[l]} ${Math.round(miles[l])} mi`)
    .join(", ");
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={label}>
      {LEVELS.map((l) =>
        miles[l] > 0 ? (
          <div
            key={l}
            style={{ width: `${(miles[l] / total) * 100}%`, background: RISK_COLOR[l] }}
            title={`${RISK_LABEL[l]}: ${Math.round(miles[l])} mi`}
          />
        ) : null,
      )}
    </div>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
      style={{ background: RISK_COLOR[level] }}
    >
      {RISK_LABEL[level]}
    </span>
  );
}
