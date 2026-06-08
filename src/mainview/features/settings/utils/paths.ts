function isWindowsAbsolutePath(value: string) {
  return /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\");
}

export function isAbsolutePath(value: string) {
  return value.startsWith("/") || isWindowsAbsolutePath(value);
}

export function cleanPath(value: string) {
  return value.trim().replace(/[\\/]+$/, "");
}
