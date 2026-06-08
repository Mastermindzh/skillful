import { useCallback, useMemo, useState } from "react";
import type { AppSettings } from "../../../../shared/types";
import { markRowRemoval, restoreRow } from "../model/pendingRemoval";
import {
  buildScanRootRows,
  createScanRootRow,
  type ScanRootRow,
  sameScanRoots,
  validateScanRootRows,
} from "../model/scanRoots";
import { cleanPath } from "../utils/paths";

export function useLibrarySettingsState(appSettings: AppSettings | null) {
  const [scanRootRows, setScanRootRows] = useState(buildScanRootRows([]));
  const validation = useMemo(() => validateScanRootRows(scanRootRows), [scanRootRows]);
  const dirty = useMemo(
    () => !sameScanRoots(validation.cleanedRoots, appSettings?.scanRoots ?? []),
    [appSettings?.scanRoots, validation.cleanedRoots]
  );

  const reset = useCallback((settings: AppSettings | null) => {
    setScanRootRows(buildScanRootRows(settings?.scanRoots ?? []));
  }, []);

  const updateRow = useCallback((id: string, value: string) => {
    setScanRootRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, path: value } : row))
    );
  }, []);

  const addRow = useCallback(() => {
    setScanRootRows((currentRows) => [...currentRows, createScanRootRow()]);
  }, []);

  const removeRow = useCallback(
    (id: string) => {
      const savedPaths = new Set(appSettings?.scanRoots ?? []);
      setScanRootRows((currentRows) => {
        const target = currentRows.find((row) => row.id === id);
        const wasSaved = target ? savedPaths.has(cleanPath(target.path)) : false;
        const savedIds = wasSaved ? new Set([id]) : new Set<string>();
        const nextRows = markRowRemoval(currentRows, id, savedIds);
        const hasEditable = nextRows.some((row) => !row.pendingRemoval);
        return hasEditable ? nextRows : [...nextRows, createScanRootRow()];
      });
    },
    [appSettings?.scanRoots]
  );

  const restore = useCallback((id: string) => {
    setScanRootRows((currentRows) => restoreRow(currentRows, id));
  }, []);

  return {
    addRow,
    dirty,
    reset,
    restoreRow: restore,
    rows: scanRootRows as ScanRootRow[],
    updateRow,
    removeRow,
    validation,
  };
}
