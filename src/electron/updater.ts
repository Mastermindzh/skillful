import { app } from "electron";
import {
  autoUpdater,
  type ProgressInfo,
  type UpdateDownloadedEvent,
  type UpdateInfo,
} from "electron-updater";
import type { DesktopUpdateAdapter } from "../desktop/runtime";
import type { AppUpdateRemoteInfo, AppUpdateState, UpdateStatusEntry } from "../shared/updates";

const statusHistory: UpdateStatusEntry[] = [];
const UPDATE_FEED_URL = "https://github.com/Mastermindzh/skillful/releases/latest";
const MAX_STATUS_HISTORY = 100;
const statusListeners = new Set<(entry: UpdateStatusEntry) => void>();
let currentUpdateInfo: AppUpdateRemoteInfo | null = null;
let updaterConfigured = false;

/**
 * Identify the Linux packaging format the app is currently running under so we can decide
 * whether to engage `electron-updater` or defer to the platform's package manager.
 *
 * - AppImage: self-updatable (electron-updater can replace the AppImage in place).
 * - deb / rpm / pacman: installed by the system package manager; in-place updates would need
 *   root and conflict with apt/dnf/pacman bookkeeping, so we route users to the release page.
 * - snap / flatpak: updated by the store (snapd, Flathub); we cannot write to our own bundle.
 */
function linuxPackagingMode(): "appimage" | "snap" | "flatpak" | "system-package" | "unknown" {
  if (process.platform !== "linux") return "unknown";
  if (process.env.APPIMAGE) return "appimage";
  if (process.env.SNAP) return "snap";
  if (process.env.FLATPAK_ID) return "flatpak";
  // Packaged Electron app on Linux without any of the above envs → installed via deb/rpm/pacman
  // (or run straight from an unpacked tree, which we treat the same way -> don't self-update).
  if (app.isPackaged) return "system-package";
  return "unknown";
}

function linuxAutoUpdateBlockedMessage(mode: ReturnType<typeof linuxPackagingMode>): string | null {
  switch (mode) {
    case "snap":
      return "Snap handles updates automatically. Run `snap refresh skillful` to update now.";
    case "flatpak":
      return "Flatpak handles updates automatically. Run `flatpak update tech.mastermindzh.skillful` to update now.";
    case "system-package":
      return "Updates are managed by your package manager.";
    default:
      return null;
  }
}

/**
 * Turn noisy `electron-updater` errors into something safe to show a user.
 *
 * `electron-updater` surfaces HTTP responses verbatim in `error.message`, including full
 * headers and cookies, which are never useful to the user and look alarming. We keep the
 * gory detail in the status entry's `details.errorMessage` for debugging and put a short
 * summary in the status `message` that the UI renders.
 */
function friendlyUpdaterError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const firstLine = raw.split(/\r?\n/, 1)[0]?.trim() ?? "";

  if (/Cannot find .+\.ya?ml in the latest release artifacts|CHANNEL_FILE_NOT_FOUND/i.test(raw)) {
    return "Update metadata is missing from the latest release. Download the new release manually instead.";
  }
  if (/\b404\b/.test(raw) || /HttpError:\s*404/i.test(raw)) {
    return "No published release was found yet. Try again after the first release is tagged.";
  }
  if (/\bENOTFOUND\b|getaddrinfo|ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENETUNREACH/i.test(raw)) {
    return "Could not reach the update server. Check your internet connection and try again.";
  }
  if (/\b403\b|rate limit/i.test(raw)) {
    return "GitHub rate limit reached while checking for updates. Try again in a few minutes.";
  }
  if (/signature|code ?sign|not signed/i.test(raw)) {
    return "Update signature could not be verified. Download the new release manually instead.";
  }

  if (!firstLine) return fallback;
  // Cap the fallback so we never dump multi-kilobyte responses into the UI.
  return firstLine.length > 200 ? `${firstLine.slice(0, 200)}\u2026` : firstLine;
}

function recordStatus(
  status: UpdateStatusEntry["status"],
  message: string,
  details?: UpdateStatusEntry["details"]
) {
  const entry: UpdateStatusEntry = {
    status,
    message,
    timestamp: Date.now(),
    details,
  };
  statusHistory.push(entry);
  if (statusHistory.length > MAX_STATUS_HISTORY) {
    statusHistory.splice(0, statusHistory.length - MAX_STATUS_HISTORY);
  }
  for (const listener of statusListeners) {
    listener(entry);
  }
  return entry;
}

function updateHash(info: UpdateInfo) {
  return info.sha512 || info.files[0]?.sha512 || "";
}

function toRemoteInfo(
  info: UpdateInfo,
  updateAvailable: boolean,
  updateReady: boolean,
  error = ""
): AppUpdateRemoteInfo {
  return {
    version: info.version,
    hash: updateHash(info),
    updateAvailable,
    updateReady,
    error,
  };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function recordUpdaterError(error: unknown, fallback: string) {
  const rawMessage = errorMessage(error, fallback);
  const friendly = friendlyUpdaterError(error, fallback);
  currentUpdateInfo = currentUpdateInfo
    ? { ...currentUpdateInfo, error: friendly }
    : {
        version: "",
        hash: "",
        updateAvailable: false,
        updateReady: false,
        error: friendly,
      };

  const latestStatus = statusHistory.at(-1);
  if (latestStatus?.status !== "error" || latestStatus.message !== friendly) {
    // Keep the full raw message in `details.errorMessage` for log/debug use; the UI
    // should render `status.message` (the friendly form) instead.
    recordStatus("error", friendly, { errorMessage: rawMessage });
  }
}

function localUpdateState(): AppUpdateState {
  return {
    localInfo: {
      version: app.getVersion(),
      hash: "",
      baseUrl: app.isPackaged ? UPDATE_FEED_URL : "",
      channel: app.isPackaged ? "stable" : "dev",
      name: app.getName(),
      identifier: "tech.mastermindzh.skillful",
    },
    updateInfo: currentUpdateInfo,
    latestStatus: statusHistory.at(-1) ?? null,
    statusHistory: [...statusHistory],
  };
}

function configureUpdater() {
  if (updaterConfigured) return;
  updaterConfigured = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = null;

  autoUpdater.on("checking-for-update", () => {
    recordStatus("checking", "Checking for updates.");
  });

  autoUpdater.on("update-not-available", (info) => {
    currentUpdateInfo = toRemoteInfo(info, false, false);
    recordStatus("no-update", "No update available.");
  });

  autoUpdater.on("update-available", (info) => {
    currentUpdateInfo = toRemoteInfo(info, true, false);
    recordStatus("update-available", `Version ${info.version} is available.`);
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    recordStatus("download-progress", `Downloading update: ${Math.round(progress.percent)}%.`, {
      progress: progress.percent,
      bytesDownloaded: progress.transferred,
      totalBytes: progress.total,
    });
  });

  autoUpdater.on("update-downloaded", (event: UpdateDownloadedEvent) => {
    currentUpdateInfo = toRemoteInfo(event, true, true);
    recordStatus("download-complete", `Version ${event.version} is ready to install.`);
  });

  autoUpdater.on("error", (error) => {
    recordUpdaterError(error, "Updater failed.");
  });
}

configureUpdater();

export function checkForUpdatesAfterStartup() {
  if (!app.isPackaged) return;
  setTimeout(() => {
    void electronUpdater.checkForUpdates();
  }, 2_500);
}

export const electronUpdater: DesktopUpdateAdapter = {
  async getUpdateState() {
    return localUpdateState();
  },
  async checkForUpdates() {
    if (!app.isPackaged) {
      recordStatus("no-update", "Auto-updates are disabled for dev builds.");
      return localUpdateState();
    }

    const linuxBlock = linuxAutoUpdateBlockedMessage(linuxPackagingMode());
    if (linuxBlock) {
      recordStatus("no-update", linuxBlock);
      return localUpdateState();
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      if (!result) {
        recordStatus("no-update", "Updater is not active for this build.");
      }
    } catch (error) {
      recordUpdaterError(error, "Failed to check for updates.");
    }
    return localUpdateState();
  },
  async downloadUpdate() {
    if (!currentUpdateInfo?.updateAvailable) {
      recordStatus("error", "No update is available to download.");
      return localUpdateState();
    }

    if (currentUpdateInfo.updateReady) {
      return localUpdateState();
    }

    try {
      recordStatus("download-starting", "Starting update download.");
      await autoUpdater.downloadUpdate();
    } catch (error) {
      recordUpdaterError(error, "Failed to download update.");
    }
    return localUpdateState();
  },
  async applyUpdate() {
    if (!currentUpdateInfo?.updateReady) {
      recordStatus("error", "No downloaded update is ready to install.");
      return;
    }

    try {
      recordStatus("applying", "Restarting to apply update.");
      autoUpdater.quitAndInstall(false, true);
    } catch (error) {
      recordUpdaterError(error, "Failed to apply update.");
    }
  },
  onUpdateStatusChange(callback) {
    statusListeners.add(callback);
    return () => {
      statusListeners.delete(callback);
    };
  },
};
