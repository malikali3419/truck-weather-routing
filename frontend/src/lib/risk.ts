import type { RiskLevel } from "../api/types";

export const LEVELS: RiskLevel[] = ["LOW", "MODERATE", "HIGH", "SEVERE", "NO_TRAVEL"];

// Bright enough to read on the dark map and panels.
export const RISK_COLOR: Record<RiskLevel, string> = {
  LOW: "#34d399",
  MODERATE: "#facc15",
  HIGH: "#fb923c",
  SEVERE: "#f43f5e",
  NO_TRAVEL: "#c084fc",
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
