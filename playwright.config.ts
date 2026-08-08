import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for CaféSmart.
 *
 * Run E2E tests:   npx playwright test
 * Run API tests:   npx playwright test --project=api
 * Run with UI:     npx playwright test --ui
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/*.spec.ts", "**/*.spec.tsx"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
    ["list"],
  ],
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    // Browser E2E tests
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
      testMatch: ["**/e2e/**/*.spec.ts"],
    },
    // Mobile viewport tests
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
      },
      testMatch: ["**/e2e/**/*.spec.ts"],
    },
    // API tests (no browser)
    {
      name: "api",
      use: {
        baseURL: process.env.API_URL ?? "http://localhost:3000",
      },
      testMatch: ["**/api/**/*.spec.ts"],
    },
  ],

  // Local dev server
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
      },
});
