import type { AppRPC } from "../../../shared/rpc";
import { clone } from "./helpers";

type MessageSpec = AppRPC["bun"]["messages"];
type MessageName = keyof MessageSpec;
type MessageListener<K extends MessageName> = (payload: MessageSpec[K]) => void;

const eventListeners = new Map<MessageName, Set<(payload: unknown) => void>>();

function listenersFor<K extends MessageName>(name: K) {
  let listeners = eventListeners.get(name);
  if (!listeners) {
    listeners = new Set();
    eventListeners.set(name, listeners);
  }
  return listeners as Set<MessageListener<K>>;
}

function emitEvent<K extends MessageName>(name: K, payload: MessageSpec[K]) {
  for (const listener of listenersFor(name)) {
    listener(clone(payload));
  }
}

export function onAppMessage<K extends MessageName>(name: K, listener: MessageListener<K>) {
  listenersFor(name).add(listener);
  return () => {
    listenersFor(name).delete(listener);
  };
}

export function emitLibraryItemsUpdated(payload: MessageSpec["libraryItemsUpdated"]) {
  emitEvent("libraryItemsUpdated", payload);
}

export function emitUpdateStatus(payload: MessageSpec["updateStatusChanged"]) {
  emitEvent("updateStatusChanged", payload);
}

export function emitGitHubImportRequested(payload: MessageSpec["githubImportRequested"]) {
  emitEvent("githubImportRequested", payload);
}

export function emitAutoGitBackupCompleted(payload: MessageSpec["autoGitBackupCompleted"]) {
  emitEvent("autoGitBackupCompleted", payload);
}
