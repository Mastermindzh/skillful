import { contextBridge, ipcRenderer } from "electron";
import type { LogLevel } from "../shared/logging";
import type { AppRPC } from "../shared/rpc";

type RequestSpec = AppRPC["bun"]["requests"];
type MessageSpec = AppRPC["bun"]["messages"];

type RequestName = keyof RequestSpec;
type MessageName = keyof MessageSpec;

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

const api: SkillfulElectronApi = {
  perfEnabled: process.env.SKILLFUL_PERF === "1",
  request(name, params) {
    return ipcRenderer.invoke("skillful:request", name, params) as Promise<
      RequestSpec[typeof name]["response"]
    >;
  },
  onMessage(name, listener) {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      incomingName: MessageName,
      payload: unknown
    ) => {
      if (incomingName === name) {
        listener(payload as MessageSpec[typeof name]);
      }
    };
    ipcRenderer.on("skillful:message", wrapped);
    return () => {
      ipcRenderer.removeListener("skillful:message", wrapped);
    };
  },
  log(level, message, details) {
    ipcRenderer.send("skillful:log", { level, message, details });
  },
};

contextBridge.exposeInMainWorld("skillful", api);
