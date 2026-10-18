/**
 * Full-stack checks against the real Django API and the real routing and
 * weather services. Run with the backend up:  npm run e2e:live
 */
import { expect, planSampleTrip, routeCard, test } from "./support";

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request, baseURL }) => {
  const res = await request.get("/api/health", { timeout: 5000 }).catch(() => null);
  if (!res?.ok()) {
    throw new Error(
      `The backend is not running at ${baseURL}. Start it first:\n` +
        "  cd backend && DEBUG=1 .venv/bin/python manage.py runserver 8000\n" +
        "then run: npm run e2e:live",
    );
  }
});

test("geocoding returns real places", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Origin" }).fill("Chicago");
  await expect(page.getByRole("listbox", { name: "Origin suggestions" }).getByRole("option").first()).toContainText(
    "Chicago",
    { timeout: 20_000 },
  );
});

test("plans a real (uncached) trip end to end", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Dallas → Atlanta" }).click();
  await expect(page.getByRole("region", { name: "Route options" })).toBeVisible({ timeout: 120_000 });
  for (const id of ["A", "B", "C"]) await expect(routeCard(page, id)).toBeVisible();
  await expect(page.getByRole("region", { name: "Recommendation" }).or(page.getByText("No safe route"))).toBeVisible();

  await expect(page.getByText("Loading forecast grid…")).toBeHidden({ timeout: 60_000 });
  await expect(page.getByText("Heatmap unavailable.")).toBeHidden();
  await page.getByRole("slider", { name: "Forecast hour after departure" }).fill("12");
  await expect(page.getByTestId("slider-time")).toContainText("+12h");

  // Re-plan at a coarser interval: routes are cached, so this is quick.
  await page.getByRole("region", { name: "Current trip" }).getByRole("radio", { name: "50 mi" }).click();
  await expect(page.getByText(/\d+ weather checks/)).toBeVisible();
});

test("simulated storm produces risky checkpoints on the real route", async ({ page }) => {
  await page.goto("/");
  // Real routing can take a while (e.g. ORS timing out before the OSRM fallback).
  await planSampleTrip(page, { storm: true, timeout: 120_000 });
  await expect(page.getByText("Simulated storm active, not real weather")).toBeVisible();
  const risky = page.getByRole("button", { name: /^Route [ABC],/ }).filter({ hasText: /No travel|Severe/ });
  await expect(risky.first()).toBeVisible({ timeout: 120_000 });
});
