export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogPayload = {
  level: LogLevel;
  message: string;
  details?: unknown;
};
