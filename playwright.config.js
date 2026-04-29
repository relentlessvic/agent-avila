// playwright.config.js — auto-starts dashboard, runs tests against it
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false,           // single dashboard instance
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3050",
    trace: "off",
    headless: true,
  },
  webServer: {
    command: "PORT=3050 node dashboard.js",
    url: "http://localhost:3050/login",
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
