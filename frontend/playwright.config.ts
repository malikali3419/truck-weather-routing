import { defineConfig, devices } from "@playwright/test";

/**
 * Two projects:
 * - ui:   the React app against the Vite dev server, with /api answered from
 *         recorded real responses (e2e/fixtures). Fast and deterministic.
 * - live: the full stack (Django + real routing and weather APIs) at LIVE_URL.
 */
const LIVE_URL = process.env.LIVE_URL ?? "http://127.0.0.1:8000";
const useSystemChrome = !process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    timezoneId: "America/Chicago",
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(useSystemChrome ? { channel: "chrome" } : {}),
    // Software WebGL so the map renders in headless browsers.
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  projects: [
    {
      name: "ui",
      testIgnore: /live\.spec\.ts/,
      use: { baseURL: "http://127.0.0.1:5173" },
    },
    {
      name: "live",
      testMatch: /live\.spec\.ts/,
      timeout: 150_000,
      use: { baseURL: LIVE_URL },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
