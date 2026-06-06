import { constants as fsConstants } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  readdir,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { AppError } from "../shared/errors";
import { caseFoldedPath, isAbsolutePathString } from "./paths";

const MAX_DIRECTORY_DEPTH = 12;

/** Checks whether a path exists without following broken links. */
export async function pathExists(filePath: string) {
  try {
    await lstat(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Throws when a path already exists, to guard create/rename operations from accidental overwrite. */
export async function throwIfPathExists(filePath: string, message: string) {
  if (await pathExists(filePath)) {
    throw new AppError("file-exists", message, { path: filePath });
  }
}

/** Trims, drops empty entries, and case-fold-deduplicates a list of filesystem paths. */
export function cleanPathList(paths: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of paths) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const key = caseFoldedPath(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/** Resolves a path list after applying the standard list cleanup rules. */
export function resolvePathList(paths: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of cleanPathList(paths)) {
    const resolved = path.resolve(entry);
    const key = caseFoldedPath(resolved);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(resolved);
  }
  return out;
}

/** Normalizes a list of paths that must already be absolute. */
export function normalizeAbsolutePathList(paths: string[], label: string) {
  const cleanedPaths = cleanPathList(paths);
  const invalidPath = cleanedPaths.find((entry) => !isAbsolutePathString(entry));
  if (invalidPath) {
    throw new AppError("invalid-path", `${label} must use absolute paths: ${invalidPath}`, {
      path: invalidPath,
    });
  }
  return resolvePathList(cleanedPaths);
}

/** Validates user-provided names that must be a single safe folder segment. */
export function validatePathSegment(name: string, label: string) {
  const segment = name.trim();
  if (!segment) throw new AppError("invalid-name", `${label} is required.`);
  if (segment === "." || segment === "..") {
    throw new AppError("invalid-name", `${label} is not valid.`);
  }
  if (
    segment.includes("/") ||
    segment.includes("\\") ||
    segment.includes("\0") ||
    path.basename(segment) !== segment
  ) {
    throw new AppError("invalid-name", `${label} cannot include path separators.`);
  }
  return segment;
}

/** Reuses the current relative parent directory while swapping the trailing file name segment. */
export function preserveRelativeParent(relativePath: string, fileName: string) {
  const parentDirectory = path.dirname(relativePath);
  return parentDirectory === "." ? fileName : path.join(parentDirectory, fileName);
}

/** Creates a directory and its parents if needed. */
export async function ensureDirectory(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Creates `dirPath` only when its parent already exists. Use this for tool install roots so a
 * missing or misconfigured tool surfaces as an error instead of being silently materialised.
 */
export async function ensureDirectoryWithExistingParent(dirPath: string) {
  const parent = path.dirname(dirPath);
  if (!(await pathExists(parent))) {
    throw new AppError("tool-install-missing-root", `Parent directory does not exist: ${parent}`, {
      path: parent,
    });
  }
  await mkdir(dirPath, { recursive: true });
}

/** Resolves a real path, returning null for missing or broken paths. */
export async function realpathOrNull(filePath: string) {
  return realpath(filePath).catch(() => null);
}

/** Lists immediate child directories under a root, excluding skipped folder names and symlinks. */
export async function listImmediateDirectories(root: string, skip = new Set<string>()) {
  const dirents = await readdir(root, { withFileTypes: true });
  return dirents
    .filter((dirent) => dirent.isDirectory() && !dirent.isSymbolicLink() && !skip.has(dirent.name))
    .map((dirent) => path.join(root, dirent.name))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Recursively lists files relative to a root. Symlinks are never followed and a depth cap
 * prevents runaway recursion in pathological trees.
 */
export async function listRelativeFiles(
  root: string,
  currentPath = root,
  skip = new Set<string>(),
  depth = 0
): Promise<string[]> {
  if (depth > MAX_DIRECTORY_DEPTH) return [];
  const dirents = await readdir(currentPath, { withFileTypes: true });
  const files: string[] = [];
  for (const dirent of dirents) {
    if (skip.has(dirent.name)) continue;
    if (dirent.isSymbolicLink()) continue;
    const absolutePath = path.join(currentPath, dirent.name);
    if (dirent.isDirectory()) {
      files.push(...(await listRelativeFiles(root, absolutePath, skip, depth + 1)));
      continue;
    }
    if (!dirent.isFile()) continue;
    files.push(path.relative(root, absolutePath));
  }
  return files.sort((a, b) => a.localeCompare(b));
}

/**
 * Resolves a user-supplied relative path inside a trusted root and rejects any resolution that
 * escapes the root via traversal or symlinks.
 */
export async function safeResolveRelative(rootPath: string, relativePath: string) {
  const resolvedRoot = await realpath(rootPath);
  return safeResolveRelativeWithResolvedRoot(resolvedRoot, relativePath);
}

/**
 * Variant that takes a root already passed through `realpath`. Callers that resolve many
 * relative paths under the same root (e.g. `readLibraryItemFiles`) use this to avoid an extra
 * `realpath` syscall per file.
 */
export async function safeResolveRelativeWithResolvedRoot(
  resolvedRoot: string,
  relativePath: string
) {
  if (!relativePath || relativePath.includes("\0") || path.isAbsolute(relativePath)) {
    throw new AppError("invalid-path", `Invalid relative path: ${relativePath}`);
  }
  const candidate = path.resolve(resolvedRoot, relativePath);
  const candidateReal = (await realpathOrNull(candidate)) ?? candidate;
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  const withinRoot = candidateReal === resolvedRoot || candidateReal.startsWith(rootWithSep);
  if (!withinRoot) {
    throw new AppError("invalid-path", `Path escapes its root: ${relativePath}`, {
      root: resolvedRoot,
      resolved: candidateReal,
    });
  }
  return candidateReal;
}

/** Atomically writes a file by staging to a temp path then renaming over the target. */
export async function atomicWriteFile(
  targetPath: string,
  data: string | Uint8Array,
  encoding: BufferEncoding = "utf8"
) {
  await ensureDirectory(path.dirname(targetPath));
  const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    if (typeof data === "string") {
      await writeFile(tempPath, data, encoding);
    } else {
      await writeFile(tempPath, data);
    }
    await rename(tempPath, targetPath);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

/** Writes a file only if it does not already exist (exclusive create). */
export async function writeFileExclusive(
  targetPath: string,
  data: string | Uint8Array,
  conflictMessage: string,
  encoding: BufferEncoding = "utf8"
) {
  await ensureDirectory(path.dirname(targetPath));
  try {
    if (typeof data === "string") {
      await writeFile(targetPath, data, { flag: "wx", encoding });
    } else {
      await writeFile(targetPath, data, { flag: "wx" });
    }
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === "EEXIST") {
      throw new AppError("file-exists", conflictMessage, { path: targetPath });
    }
    throw error;
  }
}

/**
 * Copies all files below one root into another root while preserving relative paths.
 * Uses exclusive copy by default so a duplicate target fails the operation.
 */
export async function copyRelativeFiles(
  sourceRoot: string,
  targetRoot: string,
  options: {
    skip?: Set<string>;
    conflictMessage?: (relativePath: string) => string;
    overwrite?: boolean;
  } = {}
) {
  if (!(await pathExists(sourceRoot))) return 0;

  let copiedFiles = 0;
  for (const relativePath of await listRelativeFiles(sourceRoot, sourceRoot, options.skip)) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);
    await ensureDirectory(path.dirname(targetPath));
    try {
      if (options.overwrite) {
        await copyFile(sourcePath, targetPath);
      } else {
        await copyFile(sourcePath, targetPath, fsConstants.COPYFILE_EXCL);
      }
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "EEXIST") {
        throw new AppError(
          "file-exists",
          options.conflictMessage?.(relativePath) ?? `File already exists: ${relativePath}`,
          { path: targetPath }
        );
      }
      throw error;
    }
    copiedFiles += 1;
  }

  return copiedFiles;
}
