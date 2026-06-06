import {
  emitAutoGitBackupCompleted,
  emitGitHubImportRequested,
  emitLibraryItemsUpdated,
} from "./events";
import { collectionRequests } from "./requests/collections";
import { fileRequests } from "./requests/files";
import { itemRequests } from "./requests/items";
import { settingsRequests } from "./requests/settings";
import { toolRequests } from "./requests/tools";
import { updateRequests } from "./requests/updates";

export const appRpc = {
  request: {
    ...settingsRequests,
    ...itemRequests,
    ...collectionRequests,
    ...fileRequests,
    ...toolRequests,
    ...updateRequests,
  },
};
export const perfEnabled = false;

export function logRenderer() {
  // Test runtime does not need to forward renderer logs.
}

declare global {
  interface Window {
    __SKILLFUL_E2E_BRIDGE__?: typeof appRpc;
    __SKILLFUL_E2E_EVENTS__?: {
      emitAutoGitBackupCompleted: typeof emitAutoGitBackupCompleted;
      emitGitHubImportRequested: typeof emitGitHubImportRequested;
      emitLibraryItemsUpdated: typeof emitLibraryItemsUpdated;
    };
  }
}

if (typeof window !== "undefined") {
  window.__SKILLFUL_E2E_BRIDGE__ = appRpc;
  window.__SKILLFUL_E2E_EVENTS__ = {
    emitAutoGitBackupCompleted,
    emitGitHubImportRequested,
    emitLibraryItemsUpdated,
  };
}

export * from "./events";
export * from "./fixtures";
export * from "./helpers";
export * from "./state";
export type * from "./types";
