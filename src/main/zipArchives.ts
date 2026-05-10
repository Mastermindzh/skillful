import { unzipSync } from "fflate";
import { AppError } from "../shared/errors";

export type ZipArchiveLimits = {
  compressedBytes: number;
  uncompressedBytes: number;
  entries: number;
  entryBytes: number;
};

/** Rejects zip entry names that could traverse outside a target root. */
export function assertSafeArchiveEntryName(entryPath: string, label = "Archive") {
  if (
    !entryPath ||
    entryPath.includes("\0") ||
    entryPath.startsWith("/") ||
    entryPath.startsWith("\\") ||
    /^[A-Za-z]:[\\/]/.test(entryPath) ||
    entryPath.split(/[\\/]/).some((segment) => segment === "..")
  ) {
    throw new AppError("archive-path-unsafe", `${label} contains an unsafe path: ${entryPath}`);
  }
}

/** Validates zip entry counts, sizes, path safety, and case-insensitive collisions. */
export function validateUnzippedArchiveEntries(
  unzippedFiles: Record<string, Uint8Array>,
  limits: ZipArchiveLimits,
  label = "Archive"
) {
  const entryNames = Object.keys(unzippedFiles);
  if (entryNames.length > limits.entries) {
    throw new AppError(
      "archive-too-many-entries",
      `${label} contains too many entries (> ${limits.entries}).`
    );
  }

  let totalUncompressed = 0;
  const lowercasedSeen = new Map<string, string>();

  for (const [entryPath, contents] of Object.entries(unzippedFiles)) {
    assertSafeArchiveEntryName(entryPath, label);
    if (contents.byteLength > limits.entryBytes) {
      throw new AppError("archive-entry-too-large", `${label} entry too large: ${entryPath}`);
    }
    totalUncompressed += contents.byteLength;
    if (totalUncompressed > limits.uncompressedBytes) {
      throw new AppError(
        "archive-too-large",
        `${label} uncompressed payload exceeds the allowed size.`
      );
    }
    const key = entryPath.toLowerCase();
    const prior = lowercasedSeen.get(key);
    if (prior && prior !== entryPath) {
      throw new AppError(
        "archive-path-unsafe",
        `${label} contains entries that collide on case-insensitive filesystems: ${prior} vs ${entryPath}`
      );
    }
    lowercasedSeen.set(key, entryPath);
  }
}

/** Inflates a zip payload and applies the standard Skillful import safety checks. */
export function unzipArchiveBytes(
  archiveBytes: Uint8Array,
  limits: ZipArchiveLimits,
  label = "Archive"
) {
  if (archiveBytes.byteLength > limits.compressedBytes) {
    throw new AppError(
      "archive-too-large",
      `${label} exceeds the ${limits.compressedBytes} byte size limit.`
    );
  }

  let unzippedFiles: Record<string, Uint8Array>;
  try {
    unzippedFiles = unzipSync(archiveBytes);
  } catch {
    throw new AppError("archive-format-unsupported", `${label} could not be read as a zip file.`);
  }

  validateUnzippedArchiveEntries(unzippedFiles, limits, label);
  return unzippedFiles;
}
