import { rehydrateAppErrorFromRpc } from "../shared/errors";
import type { GitHubImportDraft } from "../shared/githubImport";
import type { LogLevel } from "../shared/logging";
import type { AppRPC } from "../shared/rpc";
import type { LibraryItemSummary } from "../shared/types";
import type { UpdateStatusEntry } from "../shared/updates";

type RequestSpec = AppRPC["bun"]["requests"];
type MessageSpec = AppRPC["bun"]["messages"];
type RequestName = keyof RequestSpec;
type MessageName = keyof MessageSpec;

type ElectronRequestClient = {
  [K in RequestName]: RequestSpec[K]["params"] extends undefined
    ? () => Promise<RequestSpec[K]["response"]>
    : (params: RequestSpec[K]["params"]) => Promise<RequestSpec[K]["response"]>;
};

type SkillfulElectronApi = {
  perfEnabled: boolean;
  request<K extends RequestName>(
    name: K,
    params: RequestSpec[K]["params"]
  ): Promise<RequestSpec[K]["response"]>;
  onMessage<K extends MessageName>(
    name: K,
    listener: (payload: MessageSpec[K]) => void
  ): () => void;
  log(level: LogLevel, message: string, details?: unknown): void;
};

declare global {
  interface Window {
    skillful?: SkillfulElectronApi;
  }
}

type LibraryItemsUpdatedPayload = { libraryItems: LibraryItemSummary[]; reason: string };
export const perfEnabled = Boolean(window.skillful?.perfEnabled);

const libraryItemsUpdatedListeners = new Set<(payload: LibraryItemsUpdatedPayload) => void>();
const githubImportListeners = new Set<(payload: GitHubImportDraft) => void>();
const updateStatusListeners = new Set<(payload: UpdateStatusEntry) => void>();

function electronApi() {
  if (!window.skillful) {
    throw new Error("Electron Skillful bridge is unavailable.");
  }
  return window.skillful;
}

function wrapRequest<T extends Promise<unknown>>(request: T): T {
  return request.catch((error: unknown) => {
    const hydrated = rehydrateAppErrorFromRpc(error);
    throw hydrated ?? error;
  }) as T;
}

const request = new Proxy({} as ElectronRequestClient, {
  get(_target, prop) {
    const name = prop as RequestName;
    return (params?: unknown) =>
      wrapRequest(electronApi().request(name, params as RequestSpec[typeof name]["params"]));
  },
});

export const appRpc = { request };

export function logRenderer(level: LogLevel, message: string, details?: unknown) {
  if (window.skillful) {
    window.skillful.log(level, message, details);
    return;
  }

  const text = details === undefined ? message : `${message} ${JSON.stringify(details)}`;
  switch (level) {
    case "debug":
      console.debug(text);
      break;
    case "info":
      console.info(text);
      break;
    case "warn":
      console.warn(text);
      break;
    case "error":
      console.error(text);
      break;
  }
}

// Subscribe lazily so importing this module in a non-Electron context (e.g. Vitest) does
// not throw before the bridge is installed. In the real Electron renderer the preload has
// already exposed `window.skillful` by the time this runs.
if (window.skillful) {
  window.skillful.onMessage("libraryItemsUpdated", (payload) => {
    for (const listener of libraryItemsUpdatedListeners) listener(payload);
  });
  window.skillful.onMessage("githubImportRequested", (payload) => {
    for (const listener of githubImportListeners) listener(payload);
  });
  window.skillful.onMessage("updateStatusChanged", (payload) => {
    for (const listener of updateStatusListeners) listener(payload);
  });
}

export function onLibraryItemsUpdated(listener: (payload: LibraryItemsUpdatedPayload) => void) {
  libraryItemsUpdatedListeners.add(listener);
  return () => {
    libraryItemsUpdatedListeners.delete(listener);
  };
}

export function onGitHubImportRequested(listener: (payload: GitHubImportDraft) => void) {
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
