import { expect, mockApi, test } from "./support";

test.describe("Trip form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows the empty state", async ({ page }) => {
    await expect(page).toHaveTitle("Weather-aware truck routing");
    await expect(page.getByRole("heading", { name: "Weather-aware truck routing" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Plan a trip" })).toBeVisible();
    await expect(page.getByText("Plan a trip to compare routes.")).toBeVisible();
    for (const trip of ["Denver → Chicago", "Dallas → Atlanta", "Seattle → Salt Lake City"]) {
      await expect(page.getByRole("button", { name: trip })).toBeVisible();
    }
    await expect(page.getByRole("radio", { name: "10 mi" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByLabel("Load weight")).toHaveValue("40000");
  });

  test("requires origin and destination", async ({ page }) => {
    const api = await mockApi(page);
    await page.getByRole("button", { name: "Find the safest route" }).click();
    await expect(page.getByRole("alert")).toHaveText(/Choose an origin and a destination/);
    expect(api.plan).toHaveLength(0);
  });

  test("autocomplete with mouse and keyboard, then swap", async ({ page }) => {
    const api = await mockApi(page);
    const origin = page.getByRole("combobox", { name: "Origin" });
    const destination = page.getByRole("combobox", { name: "Destination" });

    await origin.fill("Denv");
    const list = page.getByRole("listbox", { name: "Origin suggestions" });
    await expect(list.getByRole("option").first()).toHaveText("Denver, CO, USA");
    await origin.press("ArrowDown");
    await origin.press("ArrowUp");
    await origin.press("Enter");
    await expect(origin).toHaveValue("Denver, CO, USA");
    await expect(list).toBeHidden();

    await destination.fill("Chica");
    await page.getByRole("listbox", { name: "Destination suggestions" }).getByRole("option").first().click();
    await expect(destination).toHaveValue("Chicago, IL, USA");
    expect(api.geocode.some((q) => q.startsWith("Denv"))).toBe(true);

    await page.getByRole("button", { name: "Swap origin and destination" }).click();
    await expect(origin).toHaveValue("Chicago, IL, USA");
    await expect(destination).toHaveValue("Denver, CO, USA");
  });

  test("shows no matches for unknown places", async ({ page }) => {
    await mockApi(page);
    await page.getByRole("combobox", { name: "Origin" }).fill("Zzzqx");
    await expect(page.getByRole("listbox", { name: "Origin suggestions" })).toHaveText("No matches");
  });

  test("validates load weight", async ({ page }) => {
    const api = await mockApi(page);
    await page.getByRole("combobox", { name: "Origin" }).fill("Denv");
    await page.getByRole("option").first().click();
    await page.getByRole("combobox", { name: "Destination" }).fill("Chica");
    await page.getByRole("option").first().click();

    await page.getByLabel("Load weight").fill("90000");
    await page.getByRole("button", { name: "Find the safest route" }).click();
    await expect(page.getByRole("alert")).toHaveText(/between 0 and 80,000 lb/);

    await page.getByLabel("Load weight").fill("");
    await page.getByRole("button", { name: "Find the safest route" }).click();
    await expect(page.getByRole("alert")).toHaveText(/between 0 and 80,000 lb/);
    expect(api.plan).toHaveLength(0);
  });

  test("sends the trip the user entered", async ({ page }) => {
    const api = await mockApi(page);
    await page.getByRole("combobox", { name: "Origin" }).fill("Denv");
    await page.getByRole("option").first().click();
    await page.getByRole("combobox", { name: "Destination" }).fill("Chica");
    await page.getByRole("option").first().click();
    await page.getByLabel("Departure").fill("2030-01-15T08:30");
    await page.getByLabel("Load weight").fill("42000");
    await page.getByRole("radio", { name: "25 mi" }).click();
    await page.getByRole("button", { name: "Find the safest route" }).click();

    await expect(page.getByRole("region", { name: "Route options" })).toBeVisible();
    expect(api.plan).toHaveLength(1);
    const req = api.plan[0];
    expect(req.origin).toMatchObject({ label: "Denver, CO, USA" });
    expect(req.destination).toMatchObject({ label: "Chicago, IL, USA" });
    expect(req.load_weight_lb).toBe(42000);
    expect(req.sample_interval_mi).toBe(25);
    expect(req.simulate_storm).toBe(false);
    // 08:30 in America/Chicago (CST, UTC-6) is 14:30 UTC.
    expect(req.departure_at).toBe("2030-01-15T14:30:00.000Z");
  });

  test("shows a loading state while planning", async ({ page }) => {
    await mockApi(page, { planDelayMs: 1500 });
    await page.getByRole("button", { name: "Denver → Chicago" }).click();
    await expect(page.getByRole("button", { name: "Checking routes and weather…" })).toBeDisabled();
    await expect(page.getByText("Planning your trip")).toBeVisible();
    await expect(page.getByLabel("Loading routes")).toBeVisible();
    await expect(page.getByRole("region", { name: "Route options" })).toBeVisible();
    await expect(page.getByText("Planning your trip")).toBeHidden();
  });

  test("shows server errors", async ({ page }) => {
    await mockApi(page, {
      planError: { status: 504, body: { detail: "Routing service is slow to respond, please try again" } },
    });
    await page.getByRole("button", { name: "Denver → Chicago" }).click();
    await expect(page.getByRole("alert")).toHaveText("Routing service is slow to respond, please try again");
  });

  test("shows field validation errors from the API", async ({ page }) => {
    await mockApi(page, {
      planError: { status: 400, body: { departure_at: ["Departure time is in the past."] } },
    });
    await page.getByRole("button", { name: "Denver → Chicago" }).click();
    await expect(page.getByRole("alert")).toHaveText("departure at: Departure time is in the past.");
  });
});
