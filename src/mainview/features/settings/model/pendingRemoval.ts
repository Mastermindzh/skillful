/**
 * Shared helpers for the "transactional remove" pattern used by editable rows
 * inside the Settings modal (tool rows, scan root rows). Removing a row that is
 * already saved keeps it visible with `pendingRemoval: true` so the user can
 * undo the action; pressing Save filters those rows out, pressing Cancel
 * restores the saved state.
 *
 * Rows that were added in the current session (not yet saved) are dropped
 * immediately because there is nothing to undo back to.
 */
export type RemovableRow = {
  id: string;
  pendingRemoval?: boolean;
};

/**
 * Either flips `pendingRemoval: true` on the matching row (when it exists in
 * `savedIds`) or filters it out entirely.
 */
export function markRowRemoval<TRow extends RemovableRow>(
  rows: TRow[],
  id: string,
  savedIds: ReadonlySet<string>
): TRow[] {
  if (savedIds.has(id)) {
    return rows.map((row) => (row.id === id ? { ...row, pendingRemoval: true } : row));
  }
  return rows.filter((row) => row.id !== id);
}

/** Clears `pendingRemoval` on the matching row. */
export function restoreRow<TRow extends RemovableRow>(rows: TRow[], id: string): TRow[] {
  return rows.map((row) => (row.id === id ? { ...row, pendingRemoval: false } : row));
}

/** True if the row exists in the array and is currently marked for removal. */
export function isPendingRemoval<TRow extends RemovableRow>(rows: TRow[], id: string): boolean {
  return rows.some((row) => row.id === id && row.pendingRemoval);
}
