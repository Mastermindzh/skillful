import path from "node:path";
import type { AbsolutePath } from "../shared/brand";

function isWindowsAbsolutePath(value: string) {
  return /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\");
}

export function isAbsolutePathString(value: string): boolean {
  return value.startsWith("/") || isWindowsAbsolutePath(value);
}

/** Asserts and brands a string as an absolute path. Throws when invalid. */
export function asAbsolutePath(value: string, label = "Path"): AbsolutePath {
  if (!isAbsolutePathString(value)) {
    throw new Error(`${label} must be an absolute path: ${value}`);
  }
  return path.resolve(value) as AbsolutePath;
}

/** Lower-cases an absolute path on case-insensitive platforms only. */
export function caseFoldedPath(value: string) {
  if (process.platform === "win32" || process.platform === "darwin") {
    return value.toLowerCase();
  }
  return value;
}
