import type { LibraryItemDocument } from "../../../shared/types";

export type LoadState = "idle" | "loading" | "saving" | "error";
export type DraftMap = Record<string, string>;

function draftKey(itemId: string, relativePath: string) {
  return `${itemId}::${relativePath}`;
}

/**
 * Preserves unsaved edits per library item file instead of sharing state across every SKILL.md. Returns
 * the same `existingDrafts` reference when every file in `nextDocument` already has a draft
 * entry, so consumers (`useLibraryItemLibrary`, the editor) don't re-render on every reload.
 */
export function buildDraftMap(nextDocument: LibraryItemDocument, existingDrafts: DraftMap) {
  let nextDrafts: DraftMap | null = null;
  for (const file of nextDocument.files) {
    const key = draftKey(nextDocument.item.id, file.relativePath);
    if (key in existingDrafts) continue;
    if (!nextDrafts) nextDrafts = { ...existingDrafts };
    nextDrafts[key] = file.content;
  }
  return nextDrafts ?? existingDrafts;
}

/** Exposes drafts for the active library item using relative paths so the editor stays simple. */
export function draftsForDocument(document: LibraryItemDocument | null, drafts: DraftMap) {
  if (!document) return {} as DraftMap;
  return Object.fromEntries(
    document.files.map((file) => {
      const key = draftKey(document.item.id, file.relativePath);
      return [file.relativePath, drafts[key] ?? file.content];
    })
  );
}

export function writeDraft(
  document: LibraryItemDocument,
  drafts: DraftMap,
  relativePath: string,
  value: string
) {
  return {
    ...drafts,
    [draftKey(document.item.id, relativePath)]: value,
  };
}

/** Returns only files whose current draft differs from the last loaded content. */
export function dirtyFilesForDocument(document: LibraryItemDocument | null, drafts: DraftMap) {
  return (
    document?.files.filter((file) => {
      const key = draftKey(document.item.id, file.relativePath);
      return (drafts[key] ?? file.content) !== file.content;
    }) ?? []
  );
}

/** Removes all draft entries belonging to a specific library item. */
export function clearDraftsForLibraryItem(itemId: string, drafts: DraftMap): DraftMap {
  const prefix = `${itemId}::`;
  const nextDrafts: DraftMap = {};
  for (const key of Object.keys(drafts)) {
    if (!key.startsWith(prefix)) {
      nextDrafts[key] = drafts[key];
    }
  }
  return nextDrafts;
}

/**
 * Drops drafts whose library item id is no longer present. Called after a rescan so deleted or renamed
 * items do not keep stale buffers alive forever. Returns the same instance when nothing
 * changes so React state equality checks can short-circuit.
 */
export function pruneDraftsForKnownLibraryItems(
  drafts: DraftMap,
  knownLibraryItemIds: Iterable<string>
): DraftMap {
  const allowed = new Set(knownLibraryItemIds);
  let changed = false;
  const next: DraftMap = {};
  for (const [key, value] of Object.entries(drafts)) {
    const separatorIndex = key.indexOf("::");
    const itemId = separatorIndex === -1 ? key : key.slice(0, separatorIndex);
    if (allowed.has(itemId)) {
      next[key] = value;
    } else {
      changed = true;
    }
  }
  return changed ? next : drafts;
}
