import { createHash } from "node:crypto";
import { readdir, readFile, realpath, rm, stat } from "node:fs/promises";
import path from "node:path";
import { isEditableFileExtension } from "../shared/editableFiles";
import { AppError } from "../shared/errors";
import { deriveDescription, parseFrontmatter } from "../shared/frontmatter";
import { ENTRY_FILE_BY_KIND, LIBRARY_ITEM_KINDS, titleFromPathSegment } from "../shared/library";
import type {
  LibraryItemAdditionalFile,
  LibraryItemCollectionSummary,
  LibraryItemFile,
  LibraryItemKind,
  LibraryItemSummary,
} from "../shared/types";
import {
  listImmediateDirectories,
  listRelativeFiles,
  pathExists,
  safeResolveRelative,
  safeResolveRelativeWithResolvedRoot,
} from "./fs";
import { libraryRootPath } from "./libraryPaths";
import { logger } from "./logger";

export {
  deriveDescription,
  frontmatterMetadataWarnings,
  parseFrontmatter,
  validateFrontmatterMetadata,
} from "../shared/frontmatter";

export const SKIP_DIRECTORIES = new Set([".git", "node_modules", "dist", "build"]);

// Depth cap guards against pathological nesting. 10 levels comfortably covers real libraries.
const MAX_SCAN_DEPTH = 10;

/**
 * Upper bound on simultaneous item reads during a full scan. libuv's default
 * fs threadpool is 4 threads, so 16 is enough to keep it saturated without
 * spawning thousands of pending promises on large libraries.
 */
const SCAN_CONCURRENCY = 16;

/**
 * Optional cache for {@link readLibraryItemSummary}. Keys are entry file
 * absolute paths; values are the summary plus the mtime the summary was built
 * from. Callers hand in their persistent map and receive a fresh map back that
 * only contains entries still present on disk, so unreachable cache entries are
 * evicted automatically.
 */
export type LibraryItemSummaryCache = Map<string, { mtimeMs: number; summary: LibraryItemSummary }>;

/** Stable id derived from the item root path. SHA-256 avoids collisions under long paths. */
function idFromRootPath(rootPath: string) {
  return createHash("sha256").update(path.resolve(rootPath)).digest("hex");
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function collectionSummary(collectionId: string): LibraryItemCollectionSummary {
  return {
    id: collectionId,
    title: titleFromPathSegment(collectionId),
  };
}

function isEditableSkillFile(fileName: string) {
  return isEditableFileExtension(path.extname(fileName));
}

/** Derives a readable item title from frontmatter, headings, or the enclosing folder name. */
function deriveTitle(filePath: string, content: string, frontmatter: Record<string, string>) {
  if (frontmatter.name) return frontmatter.name;
  if (frontmatter.title) return frontmatter.title;
  const heading = content.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  const entryBaseName = path.basename(filePath).toLowerCase();
  if (entryBaseName === "skill.md" || entryBaseName === "agent.md") {
    return path.basename(path.dirname(filePath));
  }
  return path.basename(filePath, path.extname(filePath));
}

async function collectionDirectoriesFromRoot(scanRoot: string, kind: LibraryItemKind) {
  const rootPath = libraryRootPath(scanRoot, kind);
  if (!(await pathExists(rootPath))) return [];
  return listImmediateDirectories(rootPath, SKIP_DIRECTORIES);
}

export async function readLibraryItemSummary(
  kind: LibraryItemKind,
  collectionId: string,
  rootPath: string,
  entryPath: string,
  supportingFiles: string[]
): Promise<LibraryItemSummary> {
  const content = await readFile(entryPath, "utf8");
  const frontmatter = parseFrontmatter(content);
  return {
    id: idFromRootPath(rootPath),
    kind,
    collectionId,
    title: deriveTitle(entryPath, content, frontmatter),
    description: deriveDescription(content, frontmatter),
    rootPath,
    entryPath,
    supportingFiles,
  };
}

/** Re-reads a known item folder without walking the entire library root. */
export async function refreshLibraryItemSummary(
  libraryItem: LibraryItemSummary
): Promise<LibraryItemSummary> {
  const entryRelativePath = path.relative(libraryItem.rootPath, libraryItem.entryPath);
  const supportingFiles = (
    await listRelativeFiles(libraryItem.rootPath, libraryItem.rootPath, SKIP_DIRECTORIES)
  ).filter((file) => file !== entryRelativePath);

  return readLibraryItemSummary(
    libraryItem.kind,
    libraryItem.collectionId,
    libraryItem.rootPath,
    libraryItem.entryPath,
    supportingFiles
  );
}

async function discoverItemsInCollection(
  currentPath: string,
  kind: LibraryItemKind,
  collectionId: string,
  entryLocations: EntryLocation[],
  depth = 0
): Promise<void> {
  if (depth > MAX_SCAN_DEPTH) return;

  const dirents = await readdir(currentPath, { withFileTypes: true });
  const entryFileName = ENTRY_FILE_BY_KIND[kind];
  const itemFile = dirents.find((entry) => entry.isFile() && entry.name === entryFileName);
  if (itemFile) {
    entryLocations.push({
      kind,
      collectionId,
      rootPath: currentPath,
      entryPath: path.join(currentPath, itemFile.name),
      entryFileName,
    });
    return;
  }

  const subdirs: string[] = [];
  for (const dirent of dirents) {
    if (SKIP_DIRECTORIES.has(dirent.name) || !dirent.isDirectory()) continue;
    subdirs.push(path.join(currentPath, dirent.name));
  }
  await Promise.all(
    subdirs.map((absolute) =>
      discoverItemsInCollection(absolute, kind, collectionId, entryLocations, depth + 1)
    )
  );
}

type EntryLocation = {
  kind: LibraryItemKind;
  collectionId: string;
  rootPath: string;
  entryPath: string;
  entryFileName: string;
};

async function buildSummaryForEntry(
  entry: EntryLocation,
  cache?: LibraryItemSummaryCache
): Promise<LibraryItemSummary> {
  const cached = cache?.get(entry.entryPath);

  // Fast path: probe mtime only when we have something to validate. Cold scans with
  // an empty cache skip this stat entirely, keeping their cost identical to the
  // pre-cache implementation (one readFile + one listRelativeFiles per item).
  if (cached && cached.summary.rootPath === entry.rootPath) {
    const entryStat = await stat(entry.entryPath);
    if (entryStat.mtimeMs === cached.mtimeMs) {
      // Entry file is unchanged; supporting files may still have moved, so re-list them.
      // listRelativeFiles is cheap compared to readFile + YAML parse, which we skip.
      const supportingFiles = (
        await listRelativeFiles(entry.rootPath, entry.rootPath, SKIP_DIRECTORIES)
      ).filter((file) => file !== entry.entryFileName);
      const refreshed: LibraryItemSummary = { ...cached.summary, supportingFiles };
      cache?.set(entry.entryPath, { mtimeMs: entryStat.mtimeMs, summary: refreshed });
      return refreshed;
    }
  }

  // Cold/miss path: read the file (which implicitly stats). One extra stat afterwards
  // populates the cache for next time and is dwarfed by the readFile cost.
  const supportingFiles = (
    await listRelativeFiles(entry.rootPath, entry.rootPath, SKIP_DIRECTORIES)
  ).filter((file) => file !== entry.entryFileName);
  const summary = await readLibraryItemSummary(
    entry.kind,
    entry.collectionId,
    entry.rootPath,
    entry.entryPath,
    supportingFiles
  );
  if (cache) {
    try {
      const entryStat = await stat(entry.entryPath);
      cache.set(entry.entryPath, { mtimeMs: entryStat.mtimeMs, summary });
    } catch {
      // If stat fails right after a successful read the file is likely being rotated;
      // skipping cache population just forces a re-read next time, which is fine.
    }
  }
  return summary;
}

async function discoverCollectionsForKind(
  scanRoot: string,
  kind: LibraryItemKind,
  entryLocations: EntryLocation[]
) {
  const collectionPaths = await collectionDirectoriesFromRoot(scanRoot, kind);
  await Promise.all(
    collectionPaths.map((collectionPath) =>
      discoverItemsInCollection(collectionPath, kind, path.basename(collectionPath), entryLocations)
    )
  );
}

export async function discoverLibraryItems(
  scanRoot: string,
  libraryItems: LibraryItemSummary[],
  cache?: LibraryItemSummaryCache
): Promise<void> {
  const entryLocations: EntryLocation[] = [];
  await Promise.all(
    LIBRARY_ITEM_KINDS.map((kind) => discoverCollectionsForKind(scanRoot, kind, entryLocations))
  );
  const summaries = await mapWithConcurrency(entryLocations, SCAN_CONCURRENCY, (entry) =>
    buildSummaryForEntry(entry, cache)
  );
  libraryItems.push(...summaries);
}

/** Lists immediate collection folders across libraryItem and agent roots. */
export async function listLibraryCollections(scanRoots: string[]) {
  const collections = new Map<string, LibraryItemCollectionSummary>();

  for (const root of scanRoots) {
    for (const kind of LIBRARY_ITEM_KINDS) {
      for (const collectionPath of await collectionDirectoriesFromRoot(root, kind)) {
        const summary = collectionSummary(path.basename(collectionPath));
        if (!collections.has(summary.id)) {
          collections.set(summary.id, summary);
        }
      }
    }
  }

  return [...collections.values()].sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Deletes a logical collection from all known skill and agent roots. Individual root/kind
 * removals that fail (permission denied, locked file on Windows) are logged as warnings so
 * the caller still makes progress on the roots that succeeded; the user can retry or clean
 * up remnants manually.
 */
export async function deleteLibraryCollection(scanRoots: string[], collectionId: string) {
  const knownCollections = await listLibraryCollections(scanRoots);
  const collection = knownCollections.find((entry) => entry.id === collectionId);

  if (!collection) {
    throw new AppError("collection-not-found", "Collection was not found.");
  }

  for (const root of scanRoots) {
    const candidatePaths = [
      path.join(libraryRootPath(root, "skill"), collectionId),
      path.join(libraryRootPath(root, "agent"), collectionId),
    ];

    for (const candidatePath of candidatePaths) {
      if (!(await pathExists(candidatePath))) continue;
      try {
        await rm(candidatePath, { recursive: true, force: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Could not remove ${candidatePath} during collection delete: ${message}`);
      }
    }
  }

  return listLibraryCollections(scanRoots);
}

export function compareLibraryItems(a: LibraryItemSummary, b: LibraryItemSummary) {
  return a.title.localeCompare(b.title) || a.entryPath.localeCompare(b.entryPath);
}

/** Returns the entry file path as the UI should address it within a libraryItem. */
function relativeEntryPath(libraryItem: LibraryItemSummary) {
  return path.relative(libraryItem.rootPath, libraryItem.entryPath);
}

/** Resolves a UI file tab path while preventing writes outside the selected libraryItem root. */
export async function resolveLibraryItemFilePath(
  libraryItem: LibraryItemSummary,
  relativePath: string
) {
  return safeResolveRelative(libraryItem.rootPath, relativePath);
}

export function editableSupportingFiles(libraryItem: LibraryItemSummary) {
  return libraryItem.supportingFiles.filter(isEditableSkillFile);
}

export function additionalLibraryItemFiles(libraryItem: LibraryItemSummary) {
  return libraryItem.supportingFiles.filter((relativePath) => !isEditableSkillFile(relativePath));
}

/** Reads editable files and lists additional files without loading their contents into the editor. */
export async function readLibraryItemFiles(libraryItem: LibraryItemSummary): Promise<{
  files: LibraryItemFile[];
  additionalFiles: LibraryItemAdditionalFile[];
}> {
  const entryRelativePath = relativeEntryPath(libraryItem);
  const allEditablePaths = [entryRelativePath, ...editableSupportingFiles(libraryItem)];
  // Resolve the root once so the per-file safe resolver skips the realpath syscall.
  const resolvedRoot = await realpath(libraryItem.rootPath);
  const files = await Promise.all(
    allEditablePaths.map(async (relativePath) => {
      const absolutePath = await safeResolveRelativeWithResolvedRoot(resolvedRoot, relativePath);
      const content = await readFile(absolutePath, "utf8");
      return {
        relativePath,
        absolutePath,
        content,
        isEntry: relativePath === entryRelativePath,
      };
    })
  );
  const additionalFiles = await Promise.all(
    additionalLibraryItemFiles(libraryItem).map(async (relativePath) => ({
      relativePath,
      absolutePath: await safeResolveRelativeWithResolvedRoot(resolvedRoot, relativePath),
    }))
  );

  return { files, additionalFiles };
}
