import type { HeatmapResponse, Place, PlanRequest, PlanResponse, StormScenario } from "./types";

export class ApiError extends Error {}

function firstMessage(body: unknown): string | null {
  if (typeof body === "string") return body;
  if (Array.isArray(body)) return firstMessage(body[0]);
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if ("detail" in obj) return firstMessage(obj.detail);
    for (const [key, value] of Object.entries(obj)) {
      const msg = firstMessage(value);
      if (msg) return key === "non_field_errors" ? msg : `${key.replace(/_/g, " ")}: ${msg}`;
    }
  }
  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(firstMessage(body) ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  geocode: (q: string, signal?: AbortSignal) =>
    request<{ results: Place[] }>(`geocode?q=${encodeURIComponent(q)}`, { signal }).then(
      (r) => r.results,
    ),
  plan: (body: PlanRequest) =>
    request<PlanResponse>("plan", { method: "POST", body: JSON.stringify(body) }),
  heatmap: (body: {
    routes: string[];
    departure_at: string;
    load_weight_lb: number;
    scenario: StormScenario | null;
  }) =>
    request<HeatmapResponse>("heatmap", { method: "POST", body: JSON.stringify(body) }),
};
