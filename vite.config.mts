import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function bridgeEntryForMode(mode: string) {
  if (mode === "e2e") return "src/mainview/test-runtime/bridge/index.ts";
  return "src/mainview/bridge.ts";
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@mainview-bridge": path.resolve(__dirname, bridgeEntryForMode(mode)),
    },
  },
  root: "src/mainview",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
}));
