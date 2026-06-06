import type { AppRPC } from "../shared/rpc";
import type { GitBackupResult, LibraryItemSummary } from "../shared/types";
import type { AppUpdateState, UpdateStatusEntry } from "../shared/updates";

type RequestSpec = AppRPC["bun"]["requests"];

/**
 * Strongly-typed map of every request handler the desktop runtime implements. The shape is
 * derived from the shared RPC surface so it stays in sync with the webview contract.
 */
export type DesktopRequestHandlers = {
  [K in keyof RequestSpec]: RequestSpec[K]["params"] extends undefined
    ? () => Promise<RequestSpec[K]["response"]>
    : (params: RequestSpec[K]["params"]) => Promise<RequestSpec[K]["response"]>;
};

/** Updater capabilities the desktop runtime depends on. */
export type DesktopUpdateAdapter = {
  getUpdateState: () => Promise<AppUpdateState>;
  checkForUpdates: () => Promise<AppUpdateState>;
  downloadUpdate: () => Promise<AppUpdateState>;
  applyUpdate: () => Promise<void>;
  onUpdateStatusChange: (callback: (entry: UpdateStatusEntry) => void) => () => void;
};

/** OS shell integration: opening files in their default app and revealing them in the file manager. */
export type DesktopShellAdapter = {
  openPath: (target: string) => Promise<void>;
  revealPath: (target: string) => Promise<void>;
};

/**
 * Runtime-specific capabilities the desktop runtime cannot implement itself. The Electron
 * shell under `src/electron/` provides the concrete adapter; new shells (e.g. a headless
 * test harness) would plug in here.
 */
export type DesktopRuntimeAdapters = {
  pickDirectory: () => Promise<string | null>;
  pickFile: (allowedFileTypes?: string) => Promise<string | null>;
  sendLibraryItemsUpdated: (libraryItems: LibraryItemSummary[], reason: string) => void;
  sendUpdateStatusChanged: (entry: UpdateStatusEntry) => void;
  sendAutoGitBackupCompleted: (result: GitBackupResult) => void;
  shell: DesktopShellAdapter;
  updater: DesktopUpdateAdapter;
};
