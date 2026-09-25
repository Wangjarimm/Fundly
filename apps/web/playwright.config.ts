import { defineConfig, devices } from "@playwright/test";

// E2E memakai backend Go sungguhan + Postgres lokal/CI (bukan mock).
// E2E_DATABASE_URL menunjuk database yang sudah dimigrasi.
const dbUrl = process.env.E2E_DATABASE_URL ?? "postgres://fundly:fundly@localhost:5432/fundly?sslmode=disable";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:4173",
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    trace: "retain-on-failure",
  },
  // PW_CHANNEL=msedge memakai Edge yang terpasang di Windows (tanpa unduhan browser).
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL } }],
  webServer: [
    {
      command: "go run ./cmd/server",
      cwd: "../../api",
      url: "http://localhost:8080/api/v1/healthz",
      env: { DATABASE_URL: dbUrl, PORT: "8080" },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run preview -- --port 4173 --strictPort",
      url: "http://localhost:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
