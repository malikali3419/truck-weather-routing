import { expect, mockApi, planSampleTrip, test } from "./support";

test.describe("Phone layout", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("works without horizontal scrolling", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await planSampleTrip(page);

    await expect(page.getByRole("region", { name: "Forecast timeline" })).toBeVisible();
    await expect(page.getByRole("slider", { name: "Forecast hour after departure" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
