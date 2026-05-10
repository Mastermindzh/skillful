import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const slowMo = Number.parseInt(process.env.PLAYWRIGHT_SLOW_MO ?? "0", 10);
const packageJson = JSON.parse(readFileSync(`${process.cwd()}/package.json`, "utf8")) as {
  version: string;
};

process.env.SKILLFUL_APP_VERSION = packageJson.version;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    launchOptions: {
      slowMo: Number.isFinite(slowMo) ? slowMo : 0,
    },
  },
  webServer: {
    command: "bun run e2e:dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
