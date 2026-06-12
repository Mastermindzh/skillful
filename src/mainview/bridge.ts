import { rehydrateAppErrorFromRpc } from "../shared/errors";
import type { LogLevel } from "../shared/logging";
import type { AppRPC } from "../shared/rpc";

type RequestSpec = AppRPC["bun"]["requests"];
type MessageSpec = AppRPC["bun"]["messages"];
type RequestName = keyof RequestSpec;
type MessageName = keyof MessageSpec;
type MessageListener<K extends MessageName> = (payload: MessageSpec[K]) => void;

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

export const perfEnabled = Boolean(window.skillful?.perfEnabled);

const messageNames = [
  "libraryItemsUpdated",
  "githubImportRequested",
  "updateStatusChanged",
  "autoGitBackupCompleted",
] as const satisfies readonly MessageName[];
const messageListeners = new Map<MessageName, Set<(payload: unknown) => void>>();

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

function listenersFor<K extends MessageName>(name: K) {
  let listeners = messageListeners.get(name);
  if (!listeners) {
    listeners = new Set();
    messageListeners.set(name, listeners);
  }
  return listeners as Set<MessageListener<K>>;
}

function emitMessage<K extends MessageName>(name: K, payload: MessageSpec[K]) {
  for (const listener of listenersFor(name)) listener(payload);
}

export function onAppMessage<K extends MessageName>(name: K, listener: MessageListener<K>) {
  listenersFor(name).add(listener);
  return () => {
    listenersFor(name).delete(listener);
  };
}

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
  for (const name of messageNames) {
    window.skillful.onMessage(name, (payload) => emitMessage(name, payload));
  }
}
