import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", "build", "dist", "tests/e2e/**"],
    env: {
      // `electron-store` imports `electron`, whose entry point downloads the Electron binary if
      // it is missing. Unit tests only need the Node-side store, so pin the dist path to keep
      // module resolution from triggering a multi-minute download inside a test timeout.
      ELECTRON_OVERRIDE_DIST_PATH: "node_modules/electron/dist",
    },
  },
});
