import { homedir } from "node:os";
import path from "node:path";
import type { AbsolutePath } from "../shared/brand";
import { isAbsolutePath, isAbsolutePathOnPlatform, isHomePath } from "../shared/paths";

/** Whether this OS can use `value` as an absolute path. */
export function isNativeAbsolutePath(value: string) {
  return isAbsolutePathOnPlatform(value, process.platform);
}

/** Resolves a configured path for this OS, expanding a leading `~` to the home directory. */
export function resolveUserPath(value: string) {
  if (!isHomePath(value)) return path.resolve(value);
  const segments = value
    .slice(1)
    .split(/[\\/]+/)
    .filter(Boolean);
  return path.join(homedir(), ...segments);
}

/** Configured paths this OS can use, with `~` expanded; another OS's paths are dropped. */
export function filterUsablePaths(paths: string[]) {
  return paths.filter(isNativeAbsolutePath).map(resolveUserPath);
}

/** Asserts and brands a string as an absolute path. Throws when invalid. */
export function asAbsolutePath(value: string, label = "Path"): AbsolutePath {
  if (!isAbsolutePath(value)) {
    throw new Error(`${label} must be an absolute path: ${value}`);
  }
  return resolveUserPath(value) as AbsolutePath;
}

/** Lower-cases an absolute path on case-insensitive platforms only. */
export function caseFoldedPath(value: string) {
  if (process.platform === "win32" || process.platform === "darwin") {
    return value.toLowerCase();
  }
  return value;
}
