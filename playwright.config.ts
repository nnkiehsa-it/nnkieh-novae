import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: "test-results/e2e",
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"]],
  retries: process.env.CI ? 1 : 0,
  testDir: "./tests/e2e",
  timeout: 90_000,
  use: {
    baseURL: process.env.NOVAE_E2E_BASE_URL ?? "http://127.0.0.1:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  workers: 1,
  projects: [
    {
      name: "bootstrap",
      testMatch: /bootstrap\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      dependencies: ["bootstrap"],
      name: "chromium-desktop",
      testIgnore: [/bootstrap\.setup\.ts/, /mobile-access\.spec\.ts/],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      dependencies: ["bootstrap"],
      name: "chromium-mobile",
      testMatch: /mobile-access\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
