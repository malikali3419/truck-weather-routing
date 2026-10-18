import type { ReactNode } from "react";
import type { RiskLevel, Segment } from "../api/types";
import { LEVELS, RISK_COLOR, RISK_LABEL } from "../lib/risk";

interface SegmentedOption<T> {
  value: T;
  label: ReactNode;
  title?: string;
}

/** Pill-style radio group. */
export function Segmented<T extends string | number | null>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className = "",
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex gap-0.5 rounded-xl bg-white/[0.04] p-1 ring-1 ring-inset ring-white/[0.06] ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition ${
              size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
            } ${active ? "bg-white/[0.1] text-white shadow-sm ring-1 ring-inset ring-white/10" : "text-slate-400 hover:text-slate-100"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function RiskPill({ level, className = "" }: { level: RiskLevel; className?: string }) {
  const color = RISK_COLOR[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}
      style={{ color, background: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}40` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      {RISK_LABEL[level]}
    </span>
  );
}

/** The route laid out by mile, each stretch colored by its risk. */
export function RiskRibbon({
  segments,
  total,
  height = "h-2",
}: {
  segments: Segment[];
  total: number;
  height?: string;
}) {
  const summary = LEVELS.map((l) => {
    const miles = segments.filter((s) => s.level === l).reduce((sum, s) => sum + s.to_mi - s.from_mi, 0);
    return miles > 0 ? `${RISK_LABEL[l]} ${Math.round(miles)} mi` : null;
  })
    .filter(Boolean)
    .join(", ");
  return (
    <div className={`relative w-full overflow-hidden rounded-full bg-white/[0.06] ${height}`} role="img" aria-label={summary}>
      {segments.map((s) => (
        <div
          key={s.from_mi}
          className="absolute inset-y-0"
          style={{
            left: `${(s.from_mi / total) * 100}%`,
            width: `${((s.to_mi - s.from_mi) / total) * 100 + 0.1}%`,
            background: RISK_COLOR[s.level],
          }}
        />
      ))}
    </div>
  );
}

export function RiskLegend({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 ${className}`}>
      {LEVELS.map((l) => (
        <li key={l} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: RISK_COLOR[l], boxShadow: `0 0 6px ${RISK_COLOR[l]}` }} />
          {RISK_LABEL[l]}
        </li>
      ))}
    </ul>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-white/[0.06] ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}
