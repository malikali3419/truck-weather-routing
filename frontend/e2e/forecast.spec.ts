import { expect, mockApi, planSampleTrip, test } from "./support";

test.describe("Forecast timeline and heatmap", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await planSampleTrip(page);
    await expect(page.getByText("Loading forecast grid…")).toBeHidden();
  });

  test("slider moves the forecast time and the truck", async ({ page }) => {
    const time = page.getByTestId("slider-time");
    await expect(time).toContainText("+0h");
    const start = await time.textContent();

    const slider = page.getByRole("slider", { name: "Forecast hour after departure" });
    await slider.fill("24");
    await expect(time).toContainText("+24h");
    expect(await time.textContent()).not.toBe(start);

    await slider.press("ArrowRight");
    await expect(time).toContainText("+25h");
    await slider.fill("48");
    await expect(time).toContainText("+48h");
  });

  test("play animates through the hours and pause stops it", async ({ page }) => {
    const time = page.getByTestId("slider-time");
    await page.getByRole("button", { name: "Play forecast animation" }).click();
    await expect(page.getByRole("button", { name: "Pause forecast animation" })).toBeVisible();
    await expect(time).not.toContainText("+0h", { timeout: 3000 });

    await page.getByRole("button", { name: "Pause forecast animation" }).click();
    const paused = await time.textContent();
    await page.waitForTimeout(1000);
    expect(await time.textContent()).toBe(paused);
  });

  test("heatmap layers can be switched and hidden", async ({ page }) => {
    const layers = page.getByRole("radiogroup", { name: "Heatmap layer" });
    await expect(layers.getByRole("radio", { name: "Risk" })).toHaveAttribute("aria-checked", "true");
    for (const [name, hint] of [
      ["Wind", "25 · 35 · 45 · 55 mph"],
      ["Rain", "0.10 · 0.25 · 0.50 · 1.00 in/hr"],
      ["Snow", "0.5 · 1 · 2 · 3 in/hr"],
      ["Off", "Heatmap hidden"],
      ["Risk", "Risk for your load"],
    ]) {
      await layers.getByRole("radio", { name }).click();
      await expect(layers.getByRole("radio", { name })).toHaveAttribute("aria-checked", "true");
      await expect(page.getByText(hint)).toBeVisible();
    }
  });

  test("risk strip hover inspects checkpoints and click opens the popup", async ({ page }) => {
    const strip = page.getByTestId("risk-strip");
    const box = (await strip.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
    await expect(page.getByText(/^Mile \d+ ·/)).toBeVisible();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
    await expect(page.getByTestId("checkpoint-popup")).toBeVisible();
  });
});

test("heatmap errors can be retried", async ({ page }) => {
  // React Query retries once, so fail the first two calls to surface the error.
  let failures = 2;
  await mockApi(page);
  await page.route("**/api/heatmap", async (route) => {
    if (failures > 0) {
      failures--;
      await route.fulfill({ status: 503, json: { detail: "Weather service rate limit reached" } });
    } else {
      await route.fallback();
    }
  });
  await page.goto("/");
  await planSampleTrip(page);

  await expect(page.getByText("Heatmap unavailable.")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Risk for your load")).toBeVisible();
  await expect(page.getByText("Heatmap unavailable.")).toBeHidden();
});
