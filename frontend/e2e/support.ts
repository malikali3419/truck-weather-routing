import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test as base, type Page } from "@playwright/test";
import type { PlanRequest, PlanResponse } from "../src/api/types";

const dir = fileURLToPath(new URL("./fixtures/", import.meta.url));
export const fixture = <T = unknown>(name: string): T =>
  JSON.parse(readFileSync(`${dir}${name}.json`, "utf8")) as T;

export interface MockOptions {
  /** Change the plan response before it is returned. */
  transformPlan?: (plan: PlanResponse, req: PlanRequest) => PlanResponse;
  planError?: { status: number; body: unknown };
  heatmapError?: { status: number; body: unknown };
  planDelayMs?: number;
}

export interface ApiLog {
  plan: PlanRequest[];
  heatmap: Record<string, unknown>[];
  geocode: string[];
}

/** Answer /api/* from recorded real responses, logging every request. */
export async function mockApi(page: Page, opts: MockOptions = {}): Promise<ApiLog> {
  const log: ApiLog = { plan: [], heatmap: [], geocode: [] };

  await page.route("**/api/geocode?*", async (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") ?? "";
    log.geocode.push(q);
    const name = q.toLowerCase().startsWith("den") ? "geocode-denver" : q.toLowerCase().startsWith("chi") ? "geocode-chicago" : null;
    await route.fulfill({ json: name ? fixture(name) : { results: [] } });
  });

  await page.route("**/api/plan", async (route) => {
    const req = route.request().postDataJSON() as PlanRequest;
    log.plan.push(req);
    if (opts.planDelayMs) await new Promise((r) => setTimeout(r, opts.planDelayMs));
    if (opts.planError) {
      await route.fulfill({ status: opts.planError.status, json: opts.planError.body });
      return;
    }
    const name = req.simulate_storm ? "plan-storm" : req.sample_interval_mi === 50 ? "plan-50" : "plan-10";
    let plan = fixture<PlanResponse>(name);
    plan = { ...plan, sample_interval_mi: req.sample_interval_mi, load_weight_lb: req.load_weight_lb };
    if (opts.transformPlan) plan = opts.transformPlan(plan, req);
    await route.fulfill({ json: plan });
  });

  await page.route("**/api/heatmap", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    log.heatmap.push(body);
    if (opts.heatmapError) {
      await route.fulfill({ status: opts.heatmapError.status, json: opts.heatmapError.body });
      return;
    }
    await route.fulfill({ json: fixture(body.scenario ? "heatmap-storm" : "heatmap") });
  });

  return log;
}

/** Fails the test on any uncaught page error or console error from our code. */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        // Network failures (e.g. a map tile) are logged by the browser, not our code.
        if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) {
          errors.push(`console: ${m.text()}`);
        }
      });
      await use(errors);
      expect(errors, "page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Plan the Denver → Chicago sample trip and wait for results. */
export async function planSampleTrip(page: Page, { storm = false, timeout = 10_000 } = {}) {
  if (storm) await page.getByLabel("Simulate a storm (demo)").check({ force: true });
  await page.getByRole("button", { name: "Denver → Chicago" }).click();
  await expect(page.getByRole("region", { name: "Route options" })).toBeVisible({ timeout });
}

export const routeCard = (page: Page, id: string) =>
  page.getByRole("button", { name: new RegExp(`^Route ${id},`) });
