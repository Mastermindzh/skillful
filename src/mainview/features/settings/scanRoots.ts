import type { TranslationKey, TranslationValues } from "../../i18n/messages";
import { cleanPath, isAbsolutePath } from "./paths";

export type ScanRootRow = {
  id: string;
  path: string;
  /**
   * When true, the row is visibly marked for removal in the UI but still in the
   * editable list. The row is excluded from validation and from the saved scan
   * roots; clicking Cancel restores it because rows are rebuilt from
   * `appSettings` on close.
   */
  pendingRemoval?: boolean;
};

export type ScanRootIssue = {
  messageKey: TranslationKey;
  values?: TranslationValues;
};

type ScanRootValidation = {
  byId: Record<string, ScanRootIssue | null>;
  cleanedRoots: string[];
  hasErrors: boolean;
};

export function createScanRootRow(path = ""): ScanRootRow {
  return {
    id: crypto.randomUUID(),
    path,
  };
}

/** Builds editable scan root rows and keeps one blank row visible for first-time setup. */
export function buildScanRootRows(paths: string[]): ScanRootRow[] {
  return (paths.length > 0 ? paths : [""]).map((path) => createScanRootRow(path));
}

/** Validates editable scan root rows and returns the cleaned paths that can be saved. */
export function validateScanRootRows(rows: ScanRootRow[]): ScanRootValidation {
  const byId: Record<string, ScanRootIssue | null> = {};
  const seen = new Map<string, string>();
  const cleanedRoots: string[] = [];
  let hasErrors = false;

  for (const row of rows) {
    if (row.pendingRemoval) {
      // Pending rows are dropped on Save and must never block it.
      byId[row.id] = null;
      continue;
    }

    const value = cleanPath(row.path);
    if (!value) {
      byId[row.id] = null;
      continue;
    }

    if (!isAbsolutePath(value)) {
      byId[row.id] = { messageKey: "settings.error.absolutePath" };
      hasErrors = true;
      continue;
    }

    const duplicateOf = seen.get(value.toLowerCase());
    if (duplicateOf) {
      byId[row.id] = { messageKey: "settings.error.duplicatePath", values: { path: duplicateOf } };
      hasErrors = true;
      continue;
    }

    seen.set(value.toLowerCase(), value);
    cleanedRoots.push(value);
    byId[row.id] = null;
  }

  return { byId, cleanedRoots, hasErrors };
}

/** Ignores generated row ids when checking whether scan roots changed. */
export function sameScanRoots(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((entry, index) => entry === right[index]);
}
