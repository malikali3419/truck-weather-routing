import type { RiskLevel } from "../api/types";

export const LEVELS: RiskLevel[] = ["LOW", "MODERATE", "HIGH", "SEVERE", "NO_TRAVEL"];

export const RISK_COLOR: Record<RiskLevel, string> = {
  LOW: "#16a34a",
  MODERATE: "#eab308",
  HIGH: "#f97316",
  SEVERE: "#dc2626",
  NO_TRAVEL: "#7e22ce",
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  SEVERE: "Severe",
  NO_TRAVEL: "No travel",
};

/** MapLibre expression: color for a feature whose `level` property is a RiskLevel. */
export const riskColorExpression = [
  "match",
  ["get", "level"],
  ...LEVELS.flatMap((l) => [l, RISK_COLOR[l]]),
  "#94a3b8",
] as unknown as string;
