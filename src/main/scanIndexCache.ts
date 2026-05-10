import { readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile, ensureDirectory, pathExists } from "./fs";
import type { LibraryItemSummaryCache } from "./scanner";
import { settingsDirectory } from "./settings";

/**
 * Persisted snapshot of the in-memory scan cache. Written to disk after each
 * full scan and read back on startup, so cold starts don't have to re-parse
 * thousands of YAML frontmatters, mtime validation covers staleness.
 *
 * Format is intentionally simple JSON; we bump `version` whenever the shape
 * changes so stale caches are silently dropped instead of misread.
 */
const CACHE_FILE_NAME = "scan-index.json";
const CACHE_VERSION = 1;

type PersistedCacheEntry = {
  entryPath: string;
  mtimeMs: number;
  summary: {
    id: string;
    kind: "skill" | "agent";
    collectionId: string;
    title: string;
    description?: string;
    rootPath: string;
    entryPath: string;
    supportingFiles: string[];
  };
};

type PersistedCache = {
  version: number;
  entries: PersistedCacheEntry[];
};

function cacheFilePath() {
  return path.join(settingsDirectory(), CACHE_FILE_NAME);
}

/** Loads a cached scan index. Missing or malformed caches return an empty map. */
export async function loadScanIndex(): Promise<LibraryItemSummaryCache> {
  const cache: LibraryItemSummaryCache = new Map();
  const filePath = cacheFilePath();
  if (!(await pathExists(filePath))) return cache;
  try {
    const content = await readFile(filePath, "utf8");
    const parsed: PersistedCache = JSON.parse(content);
    if (parsed?.version !== CACHE_VERSION || !Array.isArray(parsed.entries)) {
      return cache;
    }
    for (const entry of parsed.entries) {
      if (!entry?.entryPath || typeof entry.mtimeMs !== "number" || !entry.summary) continue;
      cache.set(entry.entryPath, {
        mtimeMs: entry.mtimeMs,
        summary: entry.summary,
      });
    }
  } catch {
    // Corrupt cache is not fatal; we'll rebuild on the next scan.
  }
  return cache;
}

/**
 * Persists the current cache to disk. Failures are swallowed, cache loss only
 * costs a cold scan next time, which is already our baseline.
 */
export async function saveScanIndex(cache: LibraryItemSummaryCache): Promise<void> {
  try {
    await ensureDirectory(settingsDirectory());
    const payload: PersistedCache = {
      version: CACHE_VERSION,
      entries: Array.from(cache.entries(), ([entryPath, value]) => ({
        entryPath,
        mtimeMs: value.mtimeMs,
        summary: value.summary,
      })),
    };
    await atomicWriteFile(cacheFilePath(), JSON.stringify(payload), "utf8");
  } catch {
    // Writing the cache is a pure optimization; ignore failures.
  }
}
