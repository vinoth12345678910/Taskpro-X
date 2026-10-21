import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Use a pre-installed Chromium when one is provided (sandboxes), otherwise Playwright's own (`npx playwright install chromium`).
const preinstalled = process.env.PW_CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const launchOptions = { ...(preinstalled ? { executablePath: preinstalled } : {}), args: ["--no-sandbox"] };

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure", launchOptions },
  webServer: { command: "node scripts/serve-out.mjs", url: "http://127.0.0.1:4173/login", reuseExistingServer: true, timeout: 30_000 },
  projects: [
    { name: "desktop", testIgnore: /mobile\.spec\.ts/, use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "mobile", testMatch: /mobile\.spec\.ts/, use: { ...devices["Pixel 5"], launchOptions } },
  ],
});
