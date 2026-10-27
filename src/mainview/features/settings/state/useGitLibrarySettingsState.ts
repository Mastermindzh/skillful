import { appRpc } from "@mainview-bridge";
import { useCallback, useMemo, useState } from "react";
import type {
  AppSettings,
  GitLibraryHostKey,
  GitLibrarySyncResult,
} from "../../../../shared/types";
import {
  buildGitLibraryRows,
  createGitLibraryRow,
  type GitLibraryRow,
  sameGitLibraries,
  validateGitLibraryRows,
} from "../model/gitLibraries";
import { markRowRemoval, restoreRow } from "../model/pendingRemoval";

export type GitLibraryHostPrompt = {
  libraryId: string;
  hostKey: GitLibraryHostKey;
};

export function useGitLibrarySettingsState(appSettings: AppSettings | null) {
  const [rows, setRows] = useState<GitLibraryRow[]>([]);
  const [statusById, setStatusById] = useState<Record<string, GitLibrarySyncResult>>({});
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hostPrompt, setHostPrompt] = useState<GitLibraryHostPrompt | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  const validation = useMemo(() => validateGitLibraryRows(rows), [rows]);
  const dirty = useMemo(
    () => !sameGitLibraries(validation.libraries, appSettings?.gitLibraries ?? []),
    [appSettings?.gitLibraries, validation.libraries]
  );

  const reset = useCallback((settings: AppSettings | null) => {
    setRows(buildGitLibraryRows(settings?.gitLibraries ?? []));
    setErrorMessage(null);
    setHostPrompt(null);
    setExpandedById({});
  }, []);

  const toggleExpanded = useCallback((id: string, expanded: boolean) => {
    setExpandedById((current) => ({ ...current, [id]: expanded }));
  }, []);

  const addRow = useCallback(() => {
    setRows((current) => [...current, createGitLibraryRow()]);
  }, []);

  const updateRow = useCallback(
    <K extends keyof GitLibraryRow>(id: string, key: K, value: GitLibraryRow[K]) => {
      setRows((current) => current.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
      setErrorMessage(null);
    },
    []
  );

  const removeRow = useCallback(
    (id: string) => {
      const savedIds = new Set((appSettings?.gitLibraries ?? []).map((library) => library.id));
      setRows((current) => markRowRemoval(current, id, savedIds));
    },
    [appSettings?.gitLibraries]
  );

  const restore = useCallback((id: string) => {
    setRows((current) => restoreRow(current, id));
  }, []);

  const applyResult = useCallback((result: GitLibrarySyncResult) => {
    setStatusById((current) => ({ ...current, [result.libraryId]: result }));
    if (result.state === "host-key-unverified" && result.host) {
      void appRpc.request.scanGitLibraryHostKey({ host: result.host }).then((hostKey) => {
        if (hostKey) setHostPrompt({ libraryId: result.libraryId, hostKey });
      });
    }
  }, []);

  /** Serialises per-library actions so a second click cannot start a concurrent git process. */
  const runAction = useCallback(
    async (libraryId: string, action: () => Promise<GitLibrarySyncResult>) => {
      setBusyIds((current) => (current.includes(libraryId) ? current : [...current, libraryId]));
      setErrorMessage(null);
      try {
        const result = await action();
        applyResult(result);
        return result;
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : String(error));
        return null;
      } finally {
        setBusyIds((current) => current.filter((id) => id !== libraryId));
      }
    },
    [applyResult]
  );

  const refreshStatuses = useCallback(async () => {
    try {
      const results = await appRpc.request.getGitLibraryStatuses();
      setStatusById(Object.fromEntries(results.map((result) => [result.libraryId, result])));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const sync = useCallback(
    (libraryId: string) => runAction(libraryId, () => appRpc.request.syncGitLibrary({ libraryId })),
    [runAction]
  );

  const push = useCallback(
    (libraryId: string) =>
      runAction(libraryId, () => appRpc.request.pushGitLibraryChanges({ libraryId })),
    [runAction]
  );

  const discard = useCallback(
    (libraryId: string) =>
      runAction(libraryId, () => appRpc.request.discardGitLibraryChanges({ libraryId })),
    [runAction]
  );

  const trustHost = useCallback(async () => {
    if (!hostPrompt) return;
    const { libraryId, hostKey } = hostPrompt;
    setHostPrompt(null);
    try {
      await appRpc.request.trustGitLibraryHost({ hostKey });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      return;
    }
    await sync(libraryId);
  }, [hostPrompt, sync]);

  const syncAll = useCallback(async () => {
    setSyncingAll(true);
    setErrorMessage(null);
    try {
      for (const result of await appRpc.request.syncAllGitLibraries()) {
        applyResult(result);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSyncingAll(false);
    }
  }, [applyResult]);

  return {
    addRow,
    busyIds,
    dirty,
    discard,
    errorMessage,
    expandedById,
    hostPrompt,
    dismissHostPrompt: () => setHostPrompt(null),
    push,
    refreshStatuses,
    removeRow,
    reset,
    restoreRow: restore,
    rows,
    statusById,
    sync,
    syncAll,
    syncingAll,
    toggleExpanded,
    trustHost,
    updateRow,
    validation,
  };
}
