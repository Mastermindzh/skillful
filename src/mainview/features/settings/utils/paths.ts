export function cleanPath(value: string) {
  return value.trim().replace(/[\\/]+$/, "");
}
