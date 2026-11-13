import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4321",
    trace: "on-first-retry",
    channel: "chrome"
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4321",
    url: "http://127.0.0.1:4321",
    reuseExistingServer: true,
    timeout: 60000
  }
});

