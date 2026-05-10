import type { Stats } from "node:fs";
import { lstat, rename, rm } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../shared/errors";
import { collectionSummaryFromFolderName, ENTRY_FILE_BY_KIND } from "../shared/library";
import { portablePathBasename, portablePathDirname } from "../shared/paths";
import type {
  ImportCollectionFromPathInput,
  LibraryItemCollectionSummary,
  LibraryItemKind,
} from "../shared/types";
import {
  copyRelativeFiles,
  ensureDirectory,
  listRelativeFiles,
  pathExists,
  throwIfPathExists,
  validatePathSegment,
} from "./fs";
import { collectionDirectory } from "./libraryPaths";
import { listLibraryCollections } from "./scanner";

function containsNestedEntryFile(files: string[], kind: LibraryItemKind) {
  const entryFileName = ENTRY_FILE_BY_KIND[kind];
  return files.some((relativePath) => {
    return (
      portablePathBasename(relativePath) === entryFileName &&
      portablePathDirname(relativePath) !== "."
    );
  });
}

/** Creates logical collection folders for both skills and agents under the default library root. */
export async function createLibraryCollection(defaultRoot: string, name: string) {
  const folderName = validatePathSegment(name, "Collection name");
  const skillsPath = collectionDirectory(defaultRoot, "skill", folderName);
  const agentsPath = collectionDirectory(defaultRoot, "agent", folderName);
  await throwIfPathExists(skillsPath, "A collection with that name already exists.");
  await throwIfPathExists(agentsPath, "A collection with that name already exists.");

  await ensureDirectory(skillsPath);
  await ensureDirectory(agentsPath);

  return collectionSummaryFromFolderName(folderName);
}

/** Imports a folder tree containing skill and/or agent folders into a new collection. */
export async function importLibraryCollection(
  defaultRoot: string,
  input: ImportCollectionFromPathInput
) {
  const folderName = validatePathSegment(input.name, "Collection name");
  const sourcePath = path.resolve(input.sourcePath);
  const skillsPath = collectionDirectory(defaultRoot, "skill", folderName);
  const agentsPath = collectionDirectory(defaultRoot, "agent", folderName);
  await throwIfPathExists(skillsPath, "A collection with that name already exists.");
  await throwIfPathExists(agentsPath, "A collection with that name already exists.");

  let sourceStats: Stats;
  try {
    sourceStats = await lstat(sourcePath);
  } catch {
    throw new AppError("invalid-path", "Imported folder path is required.");
  }

  if (!sourceStats.isDirectory()) {
    throw new AppError("invalid-path", "Imported folder path is required.");
  }

  const importFiles = await listRelativeFiles(sourcePath);
  const containsSkillFolders = containsNestedEntryFile(importFiles, "skill");
  const containsAgentFolders = containsNestedEntryFile(importFiles, "agent");

  if (!containsSkillFolders && !containsAgentFolders) {
    throw new AppError(
      "invalid-path",
      "The selected folder does not contain any skill or agent folders with SKILL.md or AGENT.md."
    );
  }

  await ensureDirectory(skillsPath);
  await ensureDirectory(agentsPath);

  try {
    const copyImportFiles = (sourceRoot: string, targetRoot: string) =>
      copyRelativeFiles(sourceRoot, targetRoot, {
        conflictMessage: (relativePath) => `Imported file already exists: ${relativePath}`,
      });

    const structuredSkillsPath = path.join(sourcePath, "skills");
    const structuredAgentsPath = path.join(sourcePath, "agents");

    if ((await pathExists(structuredSkillsPath)) || (await pathExists(structuredAgentsPath))) {
      if (await pathExists(structuredSkillsPath)) {
        await copyImportFiles(structuredSkillsPath, skillsPath);
      }
      if (await pathExists(structuredAgentsPath)) {
        await copyImportFiles(structuredAgentsPath, agentsPath);
      }
    } else {
      if (containsSkillFolders) await copyImportFiles(sourcePath, skillsPath);
      if (containsAgentFolders) await copyImportFiles(sourcePath, agentsPath);
    }
  } catch (error) {
    await rm(skillsPath, { recursive: true, force: true }).catch(() => {});
    await rm(agentsPath, { recursive: true, force: true }).catch(() => {});
    throw error;
  }

  return collectionSummaryFromFolderName(folderName);
}

/** Renames all on-disk roots that belong to a logical collection. */
export async function renameLibraryCollection(
  scanRoots: string[],
  collectionId: string,
  name: string
) {
  const nextId = validatePathSegment(name, "Collection name");
  const knownCollections = await listLibraryCollections(scanRoots);
  const existingCollection = knownCollections.find((entry) => entry.id === collectionId);

  if (!existingCollection) {
    throw new AppError("collection-not-found", "Collection was not found.");
  }

  const renamePairs: Array<{ currentPath: string; nextPath: string }> = [];

  for (const root of scanRoots) {
    const candidates = [
      collectionDirectory(root, "skill", collectionId),
      collectionDirectory(root, "agent", collectionId),
    ];

    for (const currentPath of candidates) {
      if (!(await pathExists(currentPath))) continue;
      const nextPath = path.join(path.dirname(currentPath), nextId);
      if (path.resolve(nextPath) !== path.resolve(currentPath)) {
        await throwIfPathExists(nextPath, "A collection with that name already exists.");
      }
      renamePairs.push({ currentPath, nextPath });
    }
  }

  if (renamePairs.length === 0) {
    throw new AppError("collection-not-found", "Collection was not found.");
  }

  for (const { currentPath, nextPath } of renamePairs) {
    if (path.resolve(currentPath) === path.resolve(nextPath)) continue;
    await rename(currentPath, nextPath);
  }

  return collectionSummaryFromFolderName(nextId) satisfies LibraryItemCollectionSummary;
}
