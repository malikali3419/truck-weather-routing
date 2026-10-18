import { expect, mockApi, planSampleTrip, test } from "./support";

test.describe("Light and dark mode", () => {
  test("follows the system setting by default", async ({ browser }) => {
    for (const colorScheme of ["light", "dark"] as const) {
      const page = await browser.newPage({ colorScheme });
      await page.goto("/");
      await expect(page.locator("html")).toHaveClass(colorScheme === "dark" ? /dark/ : /^(?!.*dark)/);
      await page.close();
    }
  });

  test("toggle switches the theme and remembers it", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await mockApi(page);
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/dark/);

    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(html).toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();

    await page.reload();
    await expect(html).toHaveClass(/dark/);

    // Works with results on screen too.
    await planSampleTrip(page);
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(html).not.toHaveClass(/dark/);
    await expect(page.getByRole("region", { name: "Recommendation" })).toBeVisible();
  });
});
