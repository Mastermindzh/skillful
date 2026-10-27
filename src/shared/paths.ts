function isWindowsAbsolutePath(value: string) {
  return /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\");
}

/** Platform-agnostic check: accepts POSIX, drive-letter, and UNC absolute paths. */
export function isAbsolutePath(value: string) {
  return value.startsWith("/") || isWindowsAbsolutePath(value);
}

export function toPortablePath(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

export function portablePathSegments(filePath: string) {
  return toPortablePath(filePath).split("/");
}

export function portablePathBasename(filePath: string) {
  const segments = portablePathSegments(filePath);
  return segments[segments.length - 1] ?? "";
}

export function portablePathDirname(filePath: string) {
  const normalizedPath = toPortablePath(filePath);
  const separatorIndex = normalizedPath.lastIndexOf("/");
  return separatorIndex === -1
    ? "."
    : normalizedPath.slice(0, separatorIndex) || "/";
}

export function portablePathLeafName(filePath: string) {
  return portablePathBasename(filePath.replace(/\/+$/, ""));
}

export function joinPortablePath(...parts: string[]) {
  return parts.map(toPortablePath).join("/").replace(/\/+/g, "/");
}

export function safePortableRelativePath(relativePath: string, label = "Path") {
  const normalizedPath = toPortablePath(relativePath);
  const segments = normalizedPath.split("/");
  if (
    normalizedPath.startsWith("/") ||
    normalizedPath.includes("\0") ||
    segments.some((segment) => segment === "..")
  ) {
    throw new Error(`${label} is unsafe: ${relativePath}`);
  }
  return normalizedPath;
}
