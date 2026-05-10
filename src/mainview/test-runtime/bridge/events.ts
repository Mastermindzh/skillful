import type { UpdateStatusEntry } from "../../../shared/updates";
import { clone } from "./helpers";
import type { GitHubImportRequestedPayload, LibraryItemsUpdatedPayload } from "./types";

const libraryItemsUpdatedListeners = new Set<(payload: LibraryItemsUpdatedPayload) => void>();
const githubImportListeners = new Set<(payload: GitHubImportRequestedPayload) => void>();
const updateStatusListeners = new Set<(entry: UpdateStatusEntry) => void>();

export function emitLibraryItemsUpdated(payload: LibraryItemsUpdatedPayload) {
  for (const listener of libraryItemsUpdatedListeners) {
    listener(clone(payload));
  }
}

export function emitUpdateStatus(entry: UpdateStatusEntry) {
  for (const listener of updateStatusListeners) {
    listener(clone(entry));
  }
}

export function emitGitHubImportRequested(payload: GitHubImportRequestedPayload) {
  for (const listener of githubImportListeners) {
    listener(clone(payload));
  }
}

export function onLibraryItemsUpdated(listener: (payload: LibraryItemsUpdatedPayload) => void) {
  libraryItemsUpdatedListeners.add(listener);
  return () => {
    libraryItemsUpdatedListeners.delete(listener);
  };
}

export function onGitHubImportRequested(listener: (payload: GitHubImportRequestedPayload) => void) {
  githubImportListeners.add(listener);
  return () => {
    githubImportListeners.delete(listener);
  };
}

export function onUpdateStatusChanged(listener: (payload: UpdateStatusEntry) => void) {
  updateStatusListeners.add(listener);
  return () => {
    updateStatusListeners.delete(listener);
  };
}
