import type { ZipArchiveLimits } from "./zipArchives";

/**
 * Shared hard caps for any imported zip payload.
 *
 * These limits intentionally cover both local Skillful archives and GitHub source archives so
 * archive safety is predictable regardless of where the zip came from.
 */
export const COLLECTION_ARCHIVE_LIMITS = {
  compressedBytes: 100 * 1024 * 1024,
  uncompressedBytes: 512 * 1024 * 1024,
  entries: 10_000,
  entryBytes: 100 * 1024 * 1024,
} satisfies ZipArchiveLimits;
