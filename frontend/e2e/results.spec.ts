import type { PlanResponse } from "../src/api/types";
import { expect, fixture, mockApi, planSampleTrip, routeCard, test } from "./support";

test.describe("Results", () => {
  test("shows three routes, the recommendation and the trip summary", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await planSampleTrip(page);

    const plan = fixture<PlanResponse>("plan-10");
    const rec = plan.recommendation.route_id!;

    // Form collapses into a summary.
    await expect(page.getByRole("form", { name: "Plan a trip" })).toBeHidden();
    const summary = page.getByRole("region", { name: "Current trip" });
    await expect(summary).toContainText("Denver");
    await expect(summary).toContainText("Chicago");
    await expect(summary).toContainText("40,000 lb");

    for (const r of plan.routes) await expect(routeCard(page, r.id)).toBeVisible();
    await expect(page.getByRole("region", { name: "Recommendation" })).toContainText(`Route ${rec}`);
    await expect(routeCard(page, rec)).toHaveAttribute("aria-pressed", "true");
    await expect(routeCard(page, rec)).toContainText("Best");

    // Fixture came from the fallback engine, so the notice must be shown.
    await expect(page.getByText(/truck routing service is busy/)).toBeVisible();
  });

  test("selecting routes from cards and map labels", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await planSampleTrip(page);

    await routeCard(page, "B").click();
    await expect(routeCard(page, "B")).toHaveAttribute("aria-pressed", "true");
    await expect(routeCard(page, "A")).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText("Route B checkpoints")).toBeVisible();

    await page.getByRole("button", { name: "Select route C on map" }).click();
    await expect(routeCard(page, "C")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Route C checkpoints")).toBeVisible();
    await expect(page.getByText("Route C along the way")).toBeVisible();
  });

  test("changing the sampling interval re-plans and keeps the selected route", async ({ page }) => {
    const api = await mockApi(page);
    await page.goto("/");
    await planSampleTrip(page);
    await routeCard(page, "B").click();

    const summary = page.getByRole("region", { name: "Current trip" });
    await summary.getByRole("radio", { name: "50 mi" }).click();
    await expect(summary.getByRole("radio", { name: "50 mi" })).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => api.plan.length).toBe(2);
    expect(api.plan[1].sample_interval_mi).toBe(50);

    const expected = fixture<PlanResponse>("plan-50").routes.find((r) => r.id === "B")!.checkpoints.length;
    await expect(page.getByText(`${expected} weather checks`)).toBeVisible();
    await expect(routeCard(page, "B")).toHaveAttribute("aria-pressed", "true");
  });

  test("checkpoint table filters and opens the map popup", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await planSampleTrip(page, { storm: true });
    await routeCard(page, "A").click();

    await page.getByRole("button", { name: /Route A checkpoints/ }).click();
    const rows = page.locator("tbody tr");
    const all = fixture<PlanResponse>("plan-storm").routes[0].checkpoints;
    await expect(rows).toHaveCount(all.length);

    await page.getByRole("radio", { name: /Above low/ }).click();
    const flagged = all.filter((c) => c.level !== "LOW");
    await expect(rows).toHaveCount(flagged.length);

    const worst = flagged.find((c) => c.level === "NO_TRAVEL")!;
    await rows.filter({ hasText: "No travel" }).first().click();
    const popup = page.getByTestId("checkpoint-popup");
    await expect(popup).toBeVisible();
    await expect(popup).toContainText(`Route A · mile ${Math.round(worst.mile)}`);
    await expect(popup).toContainText("No travel");
    await expect(popup).toContainText("Why:");

    await page.getByRole("button", { name: "Close popup" }).click();
    await expect(popup).toBeHidden();
  });

  test("edit trip reopens the form with the same values", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await planSampleTrip(page);

    await page.getByRole("button", { name: "Edit trip" }).click();
    const form = page.getByRole("form", { name: "Plan a trip" });
    await expect(form).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Origin" })).toHaveValue("Denver, CO, USA");
    await expect(page.getByRole("combobox", { name: "Destination" })).toHaveValue("Chicago, IL, USA");

    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(form).toBeHidden();
    await expect(page.getByRole("region", { name: "Current trip" })).toBeVisible();
  });

  test("warns when every route crosses No Travel conditions", async ({ page }) => {
    await mockApi(page, {
      transformPlan: (plan) => ({
        ...plan,
        recommendation: {
          route_id: null,
          ranking: ["A", "B", "C"],
          reasons: [],
          warning: "Every route crosses No Travel conditions at this departure time. Consider delaying departure.",
        },
      }),
    });
    await page.goto("/");
    await planSampleTrip(page);
    await expect(page.getByText("No safe route at this departure time")).toBeVisible();
    await expect(page.getByText(/Consider delaying departure/)).toBeVisible();
  });
});

test.describe("Simulated storm", () => {
  test("changes risk, the recommendation and is clearly labelled", async ({ page }) => {
    const api = await mockApi(page);
    await page.goto("/");
    await planSampleTrip(page, { storm: true });

    expect(api.plan[0].simulate_storm).toBe(true);
    await expect(page.getByText("Simulated storm active, not real weather")).toBeVisible();
    await expect(page.getByRole("region", { name: "Current trip" })).toContainText("Simulated storm");
    await expect(routeCard(page, "A")).toContainText("No travel");

    const rec = fixture<PlanResponse>("plan-storm").recommendation;
    await expect(page.getByRole("region", { name: "Recommendation" })).toContainText(`Route ${rec.route_id}`);
    for (const reason of rec.reasons) await expect(page.getByText(reason)).toBeVisible();

    // The storm is passed to the heatmap so the map shows it too.
    await expect.poll(() => api.heatmap.length).toBeGreaterThan(0);
    expect(api.heatmap[0].scenario).toMatchObject({ type: "storm" });
  });
});
