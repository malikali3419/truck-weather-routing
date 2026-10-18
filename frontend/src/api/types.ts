export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "SEVERE" | "NO_TRAVEL";

export interface Place {
  label: string;
  lat: number;
  lon: number;
}

export interface CheckpointWeather {
  wind_mph: number;
  gust_mph: number;
  rain_in_hr: number;
  snow_in_hr: number;
  temp_f: number;
  weather_code: number;
  beyond_forecast: boolean;
}

export interface Checkpoint {
  mile: number;
  lon: number;
  lat: number;
  eta_unix: number;
  weather: CheckpointWeather;
  level: RiskLevel;
  factors: { wind: RiskLevel; rain: RiskLevel; snow: RiskLevel; load: RiskLevel };
  reasons: string[];
}

export interface Segment {
  from_mi: number;
  to_mi: number;
  level: RiskLevel;
}

export interface RouteSummary {
  miles_by_level: Record<RiskLevel, number>;
  avg_risk: number;
  max_level: RiskLevel;
  has_no_travel: boolean;
  beyond_forecast: boolean;
}

export interface PlannedRoute {
  id: string;
  geometry: string;
  vertex_offsets_s: number[];
  distance_mi: number;
  duration_s: number;
  extra_duration_s: number;
  arrival_unix: number;
  summary: RouteSummary;
  segments: Segment[];
  checkpoints: Checkpoint[];
}

export interface Recommendation {
  route_id: string | null;
  ranking: string[];
  reasons: string[];
  warning: string | null;
}

export interface StormScenario {
  type: "storm";
  lat: number;
  lon: number;
  peak_unix: number;
  radius_mi: number;
}

export interface PlanResponse {
  departure_unix: number;
  load_weight_lb: number;
  sample_interval_mi: number;
  /** Set only when the user asked for a simulated storm. */
  scenario: StormScenario | null;
  routing_source: "openrouteservice" | "osrm";
  routes: PlannedRoute[];
  recommendation: Recommendation;
}

export interface PlanRequest {
  origin: Place;
  destination: Place;
  departure_at: string;
  load_weight_lb: number;
  sample_interval_mi: SampleInterval;
  simulate_storm: boolean;
}

export type SampleInterval = 10 | 25 | 50;

export type HeatLayer = "risk" | "wind" | "rain" | "snow";

export interface HeatmapResponse {
  points: [number, number][];
  grid_step_deg: number;
  times_unix: number[];
  layers: Record<HeatLayer, number[][]>;
}
