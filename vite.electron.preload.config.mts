import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist-electron",
    emptyOutDir: false,
    target: "node22",
    lib: {
      entry: "src/electron/preload.ts",
      formats: ["cjs"],
      fileName: () => "preload.cjs",
    },
    rollupOptions: {
      external: (id) => id === "electron" || id.startsWith("node:"),
    },
  },
});
