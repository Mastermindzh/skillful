import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist-electron",
    emptyOutDir: true,
    target: "node22",
    lib: {
      entry: "src/electron/main.ts",
      formats: ["cjs"],
      fileName: () => "main.cjs",
    },
    rollupOptions: {
      external: (id) =>
        id === "electron" ||
        id === "electron-store" ||
        id.startsWith("electron-store/") ||
        id === "electron-updater" ||
        id.startsWith("electron-updater/") ||
        id.startsWith("node:"),
    },
  },
});
