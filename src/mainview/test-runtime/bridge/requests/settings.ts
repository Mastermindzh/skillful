import { clone, createdDirectories, state } from "../state";
import type { RequestClient } from "../types";

export const settingsRequests = {
  async getConfig() {
    return clone(state.settings);
  },
  async saveConfig(nextConfig) {
    state.settings = {
      ...state.settings,
      scanRoots: clone(nextConfig.scanRoots),
      tools: clone(nextConfig.tools),
      toolMappings: clone(nextConfig.toolMappings),
      suppressSuccessNotifications: nextConfig.suppressSuccessNotifications,
      language: nextConfig.language,
      defaultEditorMode: nextConfig.defaultEditorMode,
    };
    return clone(state.settings);
  },
  async createDirectory({ path }) {
    createdDirectories.add(path);
    return undefined;
  },
} satisfies Pick<RequestClient, "getConfig" | "saveConfig" | "createDirectory">;
