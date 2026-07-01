import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Tests run against a running full stack (web + api + postgres),
 * by default the docker-compose web service on :8080 which proxies /v1 → api.
 *
 * Local:
 *   docker compose up --build -d
 *   docker compose run --rm api poetry run alembic upgrade head
 *   npm run test:e2e -w finance-tracking-app
 *
 * Override the target with E2E_BASE_URL.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
