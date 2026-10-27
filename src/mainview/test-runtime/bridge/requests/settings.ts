import type { GitLibrarySyncResult } from "../../../../shared/types";
import { clone, createdDirectories, state } from "../state";
import type { RequestClient } from "../types";

function gitLibraryResult(
  libraryId: string,
  overrides: Partial<GitLibrarySyncResult> = {}
): GitLibrarySyncResult {
  const library = state.settings.gitLibraries.find((entry) => entry.id === libraryId);
  return {
    libraryId,
    state: "up-to-date",
    path: state.settings.gitLibraryPaths[libraryId] ?? "",
    remoteUrl: library?.remoteUrl ?? "",
    branch: library?.branch ?? "main",
    cloned: false,
    pulled: false,
    pushed: false,
    localChanges: [],
    syncedAt: new Date().toISOString(),
    ...overrides,
  };
}

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
      gitLibraries: clone(nextConfig.gitLibraries),
      gitLibraryPaths: Object.fromEntries(
        nextConfig.gitLibraries.map((library) => [
          library.id,
          library.path || `${state.settings.defaultGitLibraryRoot}/${library.id}`,
        ])
      ),
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
  async getGitLibraryStatuses() {
    return state.settings.gitLibraries.map((library) => gitLibraryResult(library.id));
  },
  async syncGitLibrary({ libraryId }) {
    return gitLibraryResult(libraryId, { pulled: true });
  },
  async syncAllGitLibraries() {
    return state.settings.gitLibraries.map((library) =>
      gitLibraryResult(library.id, { pulled: true })
    );
  },
  async pushGitLibraryChanges({ libraryId }) {
    return gitLibraryResult(libraryId, { pushed: true });
  },
  async discardGitLibraryChanges({ libraryId }) {
    return gitLibraryResult(libraryId, { pulled: true });
  },
  async scanGitLibraryHostKey({ host }) {
    return { host, keyType: "ED25519", fingerprint: "SHA256:mockfingerprintvalue" };
  },
  async trustGitLibraryHost() {
    return undefined;
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
  | "getGitLibraryStatuses"
  | "syncGitLibrary"
  | "syncAllGitLibraries"
  | "pushGitLibraryChanges"
  | "discardGitLibraryChanges"
  | "scanGitLibraryHostKey"
  | "trustGitLibraryHost"
>;
