import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "../tests/e2e",
  outputDir: "../test-results",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: "http://127.0.0.1:5178",
    trace: "on-first-retry"
  },
  webServer: [
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      command: "PORT=8788 node scripts/start-e2e-service.mjs",
      url: "http://127.0.0.1:8788/api/health",
      reuseExistingServer: false
    },
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      command:
        "FITNESS_API_ORIGIN=http://127.0.0.1:8788 npm run dev:web -- --port 5178 --strictPort",
      url: "http://127.0.0.1:5178",
      reuseExistingServer: false
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
