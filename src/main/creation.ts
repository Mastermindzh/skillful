import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { EDITABLE_FILE_EXTENSIONS } from "../shared/editableFiles";
import { AppError } from "../shared/errors";
import { deriveDescription } from "../shared/frontmatter";
import { ENTRY_FILE_BY_KIND, libraryItemLabel, slugFromText } from "../shared/library";
import { applyLineEnding, detectLineEnding, normalizeLineEndings } from "../shared/text";
import type {
  CreateLibraryItemInput,
  LibraryItemKind,
  LibraryItemSummary,
  MoveLibraryItemInput,
} from "../shared/types";
import {
  copyRelativeFiles,
  ensureDirectory,
  pathExists,
  preserveRelativeParent,
  throwIfPathExists,
  validatePathSegment,
  writeFileExclusive,
} from "./fs";
import { collectionDirectory } from "./libraryPaths";
import { caseFoldedPath } from "./paths";
import {
  additionalLibraryItemFiles,
  editableSupportingFiles,
  listLibraryCollections,
  readLibraryItemSummary,
  resolveLibraryItemFilePath,
} from "./scanner";

const EDITABLE_FILE_EXTENSIONS_SET = new Set<string>(EDITABLE_FILE_EXTENSIONS);

function validateItemTitle(name: string) {
  const title = name.trim();
  if (!title) throw new AppError("invalid-name", "Item name is required.");
  if (/[\r\n]/.test(title)) {
    throw new AppError("invalid-name", "Item name must be a single line.");
  }
  return title;
}

function validateItemDescription(description: string) {
  const summary = description.trim();
  if (!summary) throw new AppError("invalid-name", "Item description is required.");
  return summary;
}

function slugifyItemName(name: string) {
  const normalized = slugFromText(name);

  if (!normalized) {
    throw new AppError("invalid-name", "Item name must contain letters or numbers.");
  }

  return normalized;
}

export function validateLibraryItemMetadata(name: string, description: string) {
  const title = validateItemTitle(name);
  const summary = validateItemDescription(description);
  return { title, description: summary };
}

function normalizeFileName(
  name: string,
  options: {
    defaultExtension?: string;
    preserveExtensionFrom?: string;
    allowedExtensions?: Set<string>;
  } = {}
) {
  const trimmedName = validatePathSegment(name, "File name");
  const trimmedExtension = path.extname(trimmedName);
  const extension =
    trimmedExtension ||
    options.defaultExtension ||
    (options.preserveExtensionFrom ? path.extname(options.preserveExtensionFrom) : "");
  const fileName = trimmedExtension ? trimmedName : `${trimmedName}${extension}`;
  const fileExtension = trimmedExtension || path.extname(fileName);

  if (options.allowedExtensions && !options.allowedExtensions.has(fileExtension.toLowerCase())) {
    throw new AppError(
      "unsupported-extension",
      "File extension is not allowed for this operation."
    );
  }

  return fileName;
}

function normalizeMarkdownFileName(name: string) {
  return normalizeFileName(name, {
    defaultExtension: ".md",
    allowedExtensions: new Set([".md"]),
  });
}

function normalizeEditableFileName(relativePath: string, name: string) {
  return preserveRelativeParent(
    relativePath,
    normalizeFileName(name, {
      preserveExtensionFrom: relativePath,
      allowedExtensions: EDITABLE_FILE_EXTENSIONS_SET,
    })
  );
}

function normalizeAdditionalFileName(relativePath: string, name: string) {
  return preserveRelativeParent(
    relativePath,
    normalizeFileName(name, {
      preserveExtensionFrom: relativePath,
    })
  );
}

async function resolveWritableCollectionPath(
  scanRoots: string[],
  kind: LibraryItemKind,
  collectionId: string
) {
  for (const root of scanRoots) {
    const collectionPath = collectionDirectory(root, kind, collectionId);
    if (await pathExists(collectionPath)) {
      return collectionPath;
    }
  }

  return collectionDirectory(scanRoots[0], kind, collectionId);
}

async function moveDirectory(sourcePath: string, targetPath: string) {
  await ensureDirectory(path.dirname(targetPath));
  try {
    await rename(sourcePath, targetPath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException | undefined)?.code !== "EXDEV") throw error;
    await copyRelativeFiles(sourcePath, targetPath, {
      conflictMessage: () => "An item with that folder name already exists in this collection.",
    });
    await rm(sourcePath, { recursive: true, force: false });
  }
}

function itemFrontmatter(name: string, description: string) {
  const { title, description: summary } = validateLibraryItemMetadata(name, description);
  return [
    "---",
    `name: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(summary)}`,
    "---",
  ].join("\n");
}

export function createItemContent(name: string, description: string) {
  const { title, description: summary } = validateLibraryItemMetadata(name, description);
  return [itemFrontmatter(title, summary), "", `# ${title}`, "", summary, ""].join("\n");
}

function upsertFrontmatterName(content: string, name: string) {
  const nextNameLine = `name: ${validateItemTitle(name)}`;
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);

  if (!match) {
    const inferredDescription = deriveDescription(content, {}) ?? validateItemTitle(name);
    return `${itemFrontmatter(name, inferredDescription)}\n\n${content.replace(/^\s+/, "")}`;
  }

  const lines = match[1].split("\n");
  const nextLines: string[] = [];
  let replaced = false;

  for (const line of lines) {
    if (line.trim().startsWith("name:")) {
      nextLines.push(nextNameLine);
      replaced = true;
      continue;
    }
    nextLines.push(line);
  }

  if (!replaced) {
    nextLines.unshift(nextNameLine);
  }

  const startIndex = match.index ?? 0;
  return `${content.slice(0, startIndex)}---\n${nextLines.join("\n")}\n---\n${content.slice(
    startIndex + match[0].length
  )}`;
}

function replaceFirstHeading(content: string, name: string) {
  if (/^#\s+.+$/m.test(content)) {
    return content.replace(/^#\s+.+$/m, `# ${validateItemTitle(name)}`);
  }

  return `${content.trimEnd()}\n\n# ${validateItemTitle(name)}\n`;
}

function renamedSkillContent(content: string, name: string) {
  // Normalize to LF while we reason about the content, then re-apply the original style so
  // a CRLF-authored file stays CRLF after rename.
  const eol = detectLineEnding(content);
  const normalized = normalizeLineEndings(content);
  const rewritten = replaceFirstHeading(upsertFrontmatterName(normalized, name), name);
  return applyLineEnding(rewritten, eol);
}

/**
 * Renames a file inside a libraryItem's directory. The existence check is best-effort: Node does
 * not expose a cross-platform "rename-if-destination-absent" primitive, so there is a small
 * TOCTOU window between `throwIfPathExists` and `rename`. A concurrent write in that window
 * can cause `rename` to overwrite (POSIX) or fail (Win32). Acceptable in this single-user
 * desktop app because library mutations are funneled through the libraryItem store's config lock.
 */
async function renameKnownSkillPath(
  libraryItem: LibraryItemSummary,
  currentRelativePath: string,
  nextRelativePath: string,
  allowedPaths: string[],
  missingMessage: string
) {
  if (!allowedPaths.includes(currentRelativePath)) {
    throw new AppError("file-not-found", missingMessage);
  }

  const currentPath = await resolveLibraryItemFilePath(libraryItem, currentRelativePath);
  const nextPath = await resolveLibraryItemFilePath(libraryItem, nextRelativePath);

  await throwIfPathExists(nextPath, "A file with that name already exists.");
  await rename(currentPath, nextPath);
  return nextRelativePath;
}

async function deleteKnownSkillPath(
  libraryItem: LibraryItemSummary,
  relativePath: string,
  allowedPaths: string[],
  missingMessage: string
) {
  if (!allowedPaths.includes(relativePath)) {
    throw new AppError("file-not-found", missingMessage);
  }

  const filePath = await resolveLibraryItemFilePath(libraryItem, relativePath);
  await rm(filePath, { force: false });
}

async function createLibraryItemInCollection(scanRoots: string[], input: CreateLibraryItemInput) {
  const knownCollections = await listLibraryCollections(scanRoots);
  const collection = knownCollections.find((entry) => entry.id === input.collectionId);

  if (!collection) {
    throw new AppError("collection-not-found", "Collection was not found.");
  }

  const collectionPath = await resolveWritableCollectionPath(
    scanRoots,
    input.kind,
    input.collectionId
  );
  await ensureDirectory(collectionPath);

  const slug = slugifyItemName(input.name);
  const content = createItemContent(input.name, input.description);
  const itemRoot = path.join(collectionPath, slug);
  const entryPath = path.join(itemRoot, ENTRY_FILE_BY_KIND[input.kind]);

  await throwIfPathExists(
    itemRoot,
    `A ${input.kind} with that name already exists in this collection.`
  );

  await ensureDirectory(itemRoot);
  await writeFile(entryPath, content, "utf8");
  return readLibraryItemSummary(input.kind, input.collectionId, itemRoot, entryPath, []);
}

/** Creates a library item inside a known logical collection. */
export async function createLibraryItem(
  scanRoots: string[],
  input: CreateLibraryItemInput
): Promise<LibraryItemSummary> {
  return createLibraryItemInCollection(scanRoots, input);
}

/** Renames a library item folder and updates the visible title metadata in its entry file. */
export async function renameLibraryItem(libraryItem: LibraryItemSummary, name: string) {
  const title = validateItemTitle(name);
  const slug = slugifyItemName(name);
  const currentRoot = libraryItem.rootPath;
  const nextRoot = path.join(path.dirname(currentRoot), slug);
  const nextEntryPath = path.join(nextRoot, path.basename(libraryItem.entryPath));
  // Compare by case-folded resolved paths so a case-only rename on macOS/Windows is still
  // detected as the "same root" and does not clash with its own folder on disk.
  const sameRoot =
    caseFoldedPath(path.resolve(currentRoot)) === caseFoldedPath(path.resolve(nextRoot));

  if (!sameRoot) {
    await throwIfPathExists(
      nextRoot,
      `A ${libraryItem.kind} with that name already exists in this collection.`
    );
  }

  const currentContent = await readFile(libraryItem.entryPath, "utf8");
  const nextContent = renamedSkillContent(currentContent, title);

  if (sameRoot && path.resolve(currentRoot) === path.resolve(nextRoot)) {
    // True no-op: only title/frontmatter changed.
    await writeFile(libraryItem.entryPath, nextContent, "utf8");
    return { rootPath: currentRoot, entryPath: libraryItem.entryPath };
  }

  await rename(currentRoot, nextRoot);
  await writeFile(nextEntryPath, nextContent, "utf8");
  return { rootPath: nextRoot, entryPath: nextEntryPath };
}

/** Moves a library item folder to another logical collection without changing its metadata. */
export async function moveLibraryItem(
  scanRoots: string[],
  libraryItem: LibraryItemSummary,
  input: MoveLibraryItemInput
) {
  const knownCollections = await listLibraryCollections(scanRoots);
  const collection = knownCollections.find((entry) => entry.id === input.collectionId);

  if (!collection) {
    throw new AppError("collection-not-found", "Collection was not found.");
  }

  if (input.collectionId === libraryItem.collectionId) {
    return {
      collectionId: libraryItem.collectionId,
      rootPath: libraryItem.rootPath,
      entryPath: libraryItem.entryPath,
    };
  }

  const targetCollectionPath = await resolveWritableCollectionPath(
    scanRoots,
    libraryItem.kind,
    input.collectionId
  );
  const targetRoot = path.join(targetCollectionPath, path.basename(libraryItem.rootPath));
  const targetEntryPath = path.join(targetRoot, path.basename(libraryItem.entryPath));

  await throwIfPathExists(
    targetRoot,
    `A ${libraryItem.kind} with that folder name already exists in this collection.`
  );
  await moveDirectory(libraryItem.rootPath, targetRoot);

  return {
    collectionId: input.collectionId,
    rootPath: targetRoot,
    entryPath: targetEntryPath,
  };
}

/** Creates a new editable markdown file at the libraryItem root. */
export async function createEditableSkillFile(libraryItem: LibraryItemSummary, name: string) {
  const fileName = normalizeMarkdownFileName(name);
  const absolutePath = await resolveLibraryItemFilePath(libraryItem, fileName);
  await writeFileExclusive(absolutePath, "", "A file with that name already exists.");
  return fileName;
}

/** Renames an editable markdown file while preserving any nested parent directory. */
export async function renameEditableSkillFile(
  libraryItem: LibraryItemSummary,
  relativePath: string,
  name: string
) {
  if (relativePath === path.relative(libraryItem.rootPath, libraryItem.entryPath)) {
    throw new AppError(
      "invalid-name",
      `The main ${libraryItemLabel(libraryItem.kind).toLowerCase()} file cannot be renamed.`
    );
  }

  return renameKnownSkillPath(
    libraryItem,
    relativePath,
    normalizeEditableFileName(relativePath, name),
    editableSupportingFiles(libraryItem),
    "Editable file was not found."
  );
}

/** Renames a non-editable supporting file while preserving its relative parent directory. */
export async function renameAdditionalLibraryItemFile(
  libraryItem: LibraryItemSummary,
  relativePath: string,
  name: string
) {
  return renameKnownSkillPath(
    libraryItem,
    relativePath,
    normalizeAdditionalFileName(relativePath, name),
    additionalLibraryItemFiles(libraryItem),
    "Additional file was not found."
  );
}

/** Writes uploaded supporting files into the libraryItem root without overwriting existing files. */
export async function addAdditionalSkillFiles(
  libraryItem: LibraryItemSummary,
  files: Array<{ name: string; contentBase64: string }>
) {
  for (const file of files) {
    const fileName = validatePathSegment(file.name, "File name");
    const absolutePath = await resolveLibraryItemFilePath(libraryItem, fileName);
    const fileContents = Buffer.from(file.contentBase64, "base64");
    // Use an exclusive-create write so a concurrent upload of the same name fails atomically
    // instead of depending on a TOCTOU `pathExists` check.
    await writeFileExclusive(
      absolutePath,
      new Uint8Array(fileContents),
      `A file with that name already exists: ${fileName}`
    );
  }
}

/** Deletes a non-editable supporting file from the selected libraryItem. */
export async function deleteAdditionalLibraryItemFile(
  libraryItem: LibraryItemSummary,
  relativePath: string
) {
  return deleteKnownSkillPath(
    libraryItem,
    relativePath,
    additionalLibraryItemFiles(libraryItem),
    "Additional file was not found."
  );
}

/** Deletes an editable supporting markdown file, but never the main entry file. */
export async function deleteEditableSkillFile(
  libraryItem: LibraryItemSummary,
  relativePath: string
) {
  if (relativePath === path.relative(libraryItem.rootPath, libraryItem.entryPath)) {
    throw new AppError(
      "invalid-name",
      `The main ${libraryItemLabel(libraryItem.kind).toLowerCase()} file cannot be deleted.`
    );
  }

  return deleteKnownSkillPath(
    libraryItem,
    relativePath,
    editableSupportingFiles(libraryItem),
    "Editable file was not found."
  );
}

/** Deletes the entire library item folder from disk. */
export async function deleteLibraryItem(libraryItem: LibraryItemSummary) {
  await rm(libraryItem.rootPath, { recursive: true, force: false });
}
