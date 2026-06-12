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
      minimizeToTrayOnClose: nextConfig.minimizeToTrayOnClose,
      language: nextConfig.language,
      defaultEditorMode: nextConfig.defaultEditorMode,
      onboardingTourCompleted: nextConfig.onboardingTourCompleted,
      gitBackup: clone(nextConfig.gitBackup),
    };
    return clone(state.settings);
  },
  async setOnboardingTourCompleted({ completed }) {
    state.settings = {
      ...state.settings,
      onboardingTourCompleted: completed,
    };
    return clone(state.settings);
  },
  async createDirectory({ path }) {
    createdDirectories.add(path);
    return undefined;
  },
  async initializeGitBackup({ gitBackup }) {
    const config = gitBackup;
    return {
      state: config.enabled ? "ready" : "disabled",
      remoteUrl: config.remoteUrl,
      branch: config.branch,
      changed: false,
      pushed: false,
      message: config.enabled ? "Backup repository is ready." : "Git backup is disabled.",
    };
  },
  async runGitBackup() {
    const config = state.settings.gitBackup;
    return {
      state: config.enabled ? "ready" : "disabled",
      remoteUrl: config.remoteUrl,
      branch: config.branch,
      lastBackupAt: config.enabled ? new Date().toISOString() : undefined,
      changed: config.enabled,
      pushed: config.enabled,
      message: config.enabled ? "Backup pushed." : "Git backup is disabled.",
    };
  },
  async restoreGitBackup({ gitBackup }) {
    state.settings = {
      ...state.settings,
      gitBackup: clone(gitBackup),
    };
    return clone(state.settings);
  },
} satisfies Pick<
  RequestClient,
  | "getConfig"
  | "saveConfig"
  | "setOnboardingTourCompleted"
  | "createDirectory"
  | "initializeGitBackup"
  | "runGitBackup"
  | "restoreGitBackup"
>;
