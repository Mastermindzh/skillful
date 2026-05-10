import { appRpc, onUpdateStatusChanged } from "@mainview-bridge";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppUpdateState, UpdateStatusEntry } from "../../../shared/updates";
import { useAppTranslation } from "../../i18n/i18n";
import { notify } from "../notifications/notify";

type UpdaterAction = "checking" | "downloading" | "applying" | null;

const STARTUP_UPDATE_CHECK_DELAY_MS = 15_000;

const TERMINAL_UPDATE_STATUSES = new Set([
  "no-update",
  "update-available",
  "download-complete",
  "complete",
  "error",
  "patch-chain-complete",
]);

function mergeStatusEntry(
  current: AppUpdateState | null,
  entry: UpdateStatusEntry
): AppUpdateState | null {
  if (!current) return current;

  const previousHistory = current.statusHistory;
  const alreadyRecorded = previousHistory.at(-1)?.timestamp === entry.timestamp;

  return {
    ...current,
    latestStatus: entry,
    statusHistory: alreadyRecorded ? previousHistory : [...previousHistory, entry],
  };
}

/**
 * Owns the manual update flow shown in settings: current version info, live updater status,
 * and the explicit check/download/apply actions.
 */
export function useUpdaterState() {
  const { t } = useAppTranslation();
  const [updateState, setUpdateState] = useState<AppUpdateState | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<UpdaterAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [hasStartupChecked, setHasStartupChecked] = useState(false);

  const loadUpdateState = useCallback(async () => {
    setLoading(true);
    try {
      const nextState = await appRpc.request.getUpdateState();
      setUpdateState(nextState);
      setError(null);
      setHasLoadedOnce(true);
      return nextState;
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : t("common.error.loadUpdates");
      setError(message);
      notify.error(message, { title: t("updates.title") });
      return null;
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (hasLoadedOnce) return;
    void loadUpdateState();
  }, [hasLoadedOnce, loadUpdateState]);

  useEffect(() => {
    return onUpdateStatusChanged((entry) => {
      setUpdateState((current) => mergeStatusEntry(current, entry));
      if (TERMINAL_UPDATE_STATUSES.has(entry.status)) {
        void loadUpdateState();
      }
    });
  }, [loadUpdateState]);

  const runCheckForUpdates = useCallback(
    async (background = false) => {
      if (!background) {
        setAction("checking");
      }
      setError(null);
      try {
        const nextState = await appRpc.request.checkForUpdates();
        setUpdateState(nextState);
        return nextState;
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : t("common.error.checkUpdates"));
        return null;
      } finally {
        if (!background) {
          setAction(null);
        }
      }
    },
    [t]
  );

  useEffect(() => {
    if (!hasLoadedOnce || hasStartupChecked || !updateState?.localInfo) return;

    setHasStartupChecked(true);

    if (updateState.localInfo.channel === "dev" || !updateState.localInfo.baseUrl.trim()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void runCheckForUpdates(true);
    }, STARTUP_UPDATE_CHECK_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [hasLoadedOnce, hasStartupChecked, runCheckForUpdates, updateState?.localInfo]);

  const checkForUpdates = useCallback(async () => runCheckForUpdates(false), [runCheckForUpdates]);

  const downloadUpdate = useCallback(async () => {
    setAction("downloading");
    setError(null);
    try {
      const nextState = await appRpc.request.downloadUpdate();
      setUpdateState(nextState);
      return nextState;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("common.error.downloadUpdate"));
      return null;
    } finally {
      setAction(null);
    }
  }, [t]);

  const applyUpdate = useCallback(async () => {
    setAction("applying");
    setError(null);
    try {
      await appRpc.request.applyUpdate();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("common.error.applyUpdate"));
      setAction(null);
    }
  }, [t]);

  const remoteError = updateState?.updateInfo?.error?.trim() || null;
  const errorMessage = error ?? remoteError;

  const derived = useMemo(
    () => ({
      action,
      applying: action === "applying",
      checking: action === "checking",
      downloading: action === "downloading",
      errorMessage,
      hasStartupChecked,
      hasLoadedOnce,
      isBusy: action !== null || loading,
      latestStatus: updateState?.latestStatus ?? null,
      loading,
      updateAvailable: updateState?.updateInfo?.updateAvailable ?? false,
      updateReady: updateState?.updateInfo?.updateReady ?? false,
      updateState,
    }),
    [action, errorMessage, hasLoadedOnce, hasStartupChecked, loading, updateState]
  );

  return {
    ...derived,
    applyUpdate,
    checkForUpdates,
    downloadUpdate,
    loadUpdateState,
  };
}
