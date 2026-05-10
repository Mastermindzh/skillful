import { lstat, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { AppError } from "../shared/errors";
import { collectionSummaryFromFolderName, ENTRY_FILE_BY_KIND } from "../shared/library";
import { portablePathBasename } from "../shared/paths";
import type {
  ExportCollectionArchiveInput,
  ImportCollectionFromArchiveInput,
  LibraryItemKind,
} from "../shared/types";
import { COLLECTION_ARCHIVE_LIMITS } from "./archiveLimits";
import {
  archiveFileName,
  COLLECTION_CONTENT_ROOT,
  collectionArchivePath,
  createCollectionArchiveManifest,
  KIND_BY_LIBRARY_FOLDER,
  MANIFEST_PATH,
  manifestFromArchive,
  safeArchivePath,
} from "./collectionArchiveFormat";
import {
  ensureDirectory,
  listRelativeFiles,
  pathExists,
  throwIfPathExists,
  validatePathSegment,
  writeFileExclusive,
} from "./fs";
import { collectionDirectory } from "./libraryPaths";
import { logger } from "./logger";
import { listLibraryCollections } from "./scanner";
import { unzipArchiveBytes } from "./zipArchives";
export const MAX_ARCHIVE_COMPRESSED_BYTES = COLLECTION_ARCHIVE_LIMITS.compressedBytes;
export const MAX_ARCHIVE_UNCOMPRESSED_BYTES = COLLECTION_ARCHIVE_LIMITS.uncompressedBytes;
export const MAX_ARCHIVE_ENTRIES = COLLECTION_ARCHIVE_LIMITS.entries;
export const MAX_ARCHIVE_ENTRY_BYTES = COLLECTION_ARCHIVE_LIMITS.entryBytes;

async function collectionExists(scanRoots: string[], collectionId: string) {
  const knownCollections = await listLibraryCollections(scanRoots);
  return knownCollections.find((collection) => collection.id === collectionId) ?? null;
}

async function addCollectionFilesToArchive(
  files: Record<string, Uint8Array>,
  rootPath: string,
  kind: LibraryItemKind,
  warnings: string[]
) {
  if (!(await pathExists(rootPath))) return { files: 0, entries: 0 };

  let fileCount = 0;
  let entryCount = 0;
  const entryFileName = ENTRY_FILE_BY_KIND[kind];

  for (const relativePath of await listRelativeFiles(rootPath)) {
    const normalizedPath = safeArchivePath(relativePath);
    const archivePath = collectionArchivePath(kind, normalizedPath);
    if (archivePath in files) {
      // Same collection id present under more than one scan root. Prefer the first root we
      // saw (which is usually the default library) and record a warning so the user can
      // reconcile the duplicates later instead of hard-failing the export.
      warnings.push(
        `Multiple scan roots contain ${archivePath}; kept the first occurrence and skipped ${path.join(
          rootPath,
          relativePath
        )}.`
      );
      continue;
    }
    files[archivePath] = new Uint8Array(await readFile(path.join(rootPath, relativePath)));
    fileCount += 1;
    if (portablePathBasename(normalizedPath) === entryFileName) {
      entryCount += 1;
    }
  }

  return { files: fileCount, entries: entryCount };
}

/** Exports all skill and agent folders for one logical collection into a Skillful archive. */
export async function exportLibraryCollectionArchive(
  scanRoots: string[],
  input: ExportCollectionArchiveInput
) {
  const collection = await collectionExists(scanRoots, input.collectionId);
  if (!collection) {
    throw new AppError("collection-not-found", "Collection was not found.");
  }

  const destinationFolder = path.resolve(input.destinationFolder);
  const destinationStats = await lstat(destinationFolder).catch(() => null);
  if (!destinationStats?.isDirectory()) {
    throw new AppError("invalid-path", "Export destination folder is required.");
  }

  const files: Record<string, Uint8Array> = {};
  const exportWarnings: string[] = [];
  let skillCount = 0;
  let agentCount = 0;
  let fileCount = 0;

  for (const scanRoot of scanRoots) {
    const skillStats = await addCollectionFilesToArchive(
      files,
      collectionDirectory(scanRoot, "skill", collection.id),
      "skill",
      exportWarnings
    );
    const agentStats = await addCollectionFilesToArchive(
      files,
      collectionDirectory(scanRoot, "agent", collection.id),
      "agent",
      exportWarnings
    );
    skillCount += skillStats.entries;
    agentCount += agentStats.entries;
    fileCount += skillStats.files + agentStats.files;
  }

  if (exportWarnings.length > 0 && process.env.NODE_ENV !== "production") {
    for (const warning of exportWarnings) logger.warn(warning);
  }

  const manifest = createCollectionArchiveManifest({
    collection,
    skillCount,
    agentCount,
    fileCount,
  });
  files[MANIFEST_PATH] = strToU8(JSON.stringify(manifest, null, 2));

  const archivePath = path.join(destinationFolder, archiveFileName(collection));
  await throwIfPathExists(archivePath, "A collection archive already exists at that location.");
  await writeFileExclusive(
    archivePath,
    zipSync(files, { level: 6 }),
    "A collection archive already exists at that location."
  );

  return { archivePath };
}

/** Imports a Skillful collection archive into the default library root. */
export async function importLibraryCollectionArchive(
  defaultRoot: string,
  input: ImportCollectionFromArchiveInput
) {
  const folderName = validatePathSegment(input.name, "Collection name");
  const archivePath = path.resolve(input.archivePath);
  if (path.extname(archivePath).toLowerCase() !== ".zip") {
    throw new AppError("archive-format-unsupported", "Imported archive must be a .zip file.");
  }
  const archiveStats = await lstat(archivePath).catch(() => null);
  if (!archiveStats?.isFile()) {
    throw new AppError("invalid-path", "Imported archive path is required.");
  }

  const targetPaths = {
    skill: collectionDirectory(defaultRoot, "skill", folderName),
    agent: collectionDirectory(defaultRoot, "agent", folderName),
  } satisfies Record<LibraryItemKind, string>;
  await throwIfPathExists(targetPaths.skill, "A collection with that name already exists.");
  await throwIfPathExists(targetPaths.agent, "A collection with that name already exists.");

  const unzippedFiles = unzipArchiveBytes(
    new Uint8Array(await readFile(archivePath)),
    COLLECTION_ARCHIVE_LIMITS
  );

  const manifestBytes = unzippedFiles[MANIFEST_PATH];
  if (!manifestBytes) {
    throw new AppError("archive-manifest-missing", "Collection archive manifest is missing.");
  }
  manifestFromArchive(manifestBytes);

  await ensureDirectory(targetPaths.skill);
  await ensureDirectory(targetPaths.agent);

  try {
    for (const [archiveEntryPath, contents] of Object.entries(unzippedFiles)) {
      const normalizedPath = safeArchivePath(archiveEntryPath);
      if (normalizedPath === MANIFEST_PATH) continue;
      if (normalizedPath.endsWith("/")) continue;

      const prefix = `${COLLECTION_CONTENT_ROOT}/`;
      if (!normalizedPath.startsWith(prefix)) {
        throw new AppError(
          "archive-path-unsafe",
          `Archive contains an unsupported path: ${archiveEntryPath}`
        );
      }

      const relativeToCollection = normalizedPath.slice(prefix.length);
      const [libraryFolder, ...relativeParts] = relativeToCollection.split("/");
      const kind = KIND_BY_LIBRARY_FOLDER[libraryFolder ?? ""];
      if (!kind || relativeParts.length === 0) {
        throw new AppError(
          "archive-path-unsafe",
          `Archive contains an unsupported path: ${archiveEntryPath}`
        );
      }

      const relativePath = safeArchivePath(relativeParts.join("/"));
      const targetRoot = targetPaths[kind];
      const targetPath = path.join(targetRoot, relativePath);
      const rootWithSep = targetRoot.endsWith(path.sep) ? targetRoot : targetRoot + path.sep;
      if (targetPath !== targetRoot && !targetPath.startsWith(rootWithSep)) {
        throw new AppError("archive-path-unsafe", `Archive path escapes root: ${relativePath}`);
      }
      await ensureDirectory(path.dirname(targetPath));
      await writeFileExclusive(
        targetPath,
        contents,
        `Imported file already exists: ${relativePath}`
      );
    }
  } catch (error) {
    await rm(targetPaths.skill, { recursive: true, force: true }).catch(() => {});
    await rm(targetPaths.agent, { recursive: true, force: true }).catch(() => {});
    throw error;
  }

  return collectionSummaryFromFolderName(folderName);
}
