import type { IpcMain } from "electron";
import type { LogLevel, LogPayload } from "../shared/logging";

const LOG_CHANNEL = "skillful:log";
const LOG_LEVELS = ["debug", "info", "warn", "error"] as const satisfies readonly LogLevel[];
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function configuredLogLevel(): LogLevel {
  const value = process.env.SKILLFUL_LOG_LEVEL?.trim().toLowerCase();
  return LOG_LEVELS.find((level) => level === value) ?? "info";
}

function debugScopes() {
  return new Set(
    (process.env.SKILLFUL_DEBUG ?? "")
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean)
  );
}

function shouldWrite(level: LogLevel) {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLogLevel()];
}

function shouldWriteScopedDebug(scope: string) {
  const scopes = debugScopes();
  return shouldWrite("debug") || scopes.has("*") || scopes.has(scope);
}

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
  if (!shouldWrite(level)) return;
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
  scoped(scope: string) {
    return {
      debug(message: string, details?: unknown) {
        if (shouldWriteScopedDebug(scope)) write("debug", `[${scope}] ${message}`, details);
      },
    };
  },
};
