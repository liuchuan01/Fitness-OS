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
      command: "node scripts/start-e2e-service.mjs",
      env: { PORT: "5178" },
      url: "http://127.0.0.1:5178/api/health",
      reuseExistingServer: false
    }
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {})
      }
    }
  ]
});
