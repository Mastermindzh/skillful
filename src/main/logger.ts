import type { IpcMain } from "electron";
import type { LogLevel, LogPayload } from "../shared/logging";

const LOG_CHANNEL = "skillful:log";

function normalizeDetails(details: unknown): unknown {
  if (details instanceof Error) {
    return {
      name: details.name,
      message: details.message,
      stack: details.stack,
    };
  }
  return details;
}

function detailsText(details: unknown) {
  if (details === undefined) return "";
  try {
    return ` ${JSON.stringify(normalizeDetails(details), null, 2)}`;
  } catch {
    return " [unserializable details]";
  }
}

function write(level: LogLevel, message: string, details?: unknown) {
  const text = `${message}${detailsText(details)}`;
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

export const logger = {
  channel: LOG_CHANNEL,
  watch(ipcMain: IpcMain) {
    ipcMain.on(LOG_CHANNEL, (_event, payload: LogPayload) => {
      write(payload.level, payload.message, payload.details);
    });
  },
  debug(message: string, details?: unknown) {
    write("debug", message, details);
  },
  info(message: string, details?: unknown) {
    write("info", message, details);
  },
  warn(message: string, details?: unknown) {
    write("warn", message, details);
  },
  error(message: string, details?: unknown) {
    write("error", message, details);
  },
};
