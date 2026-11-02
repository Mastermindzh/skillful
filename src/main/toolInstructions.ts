import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../shared/errors";
import { isMarkdownPath, toPortablePath } from "../shared/paths";
import {
  classifyInstructionsFile,
  instructionsChangedError,
  type InstructionsFileRef,
  type LocateInstructionsFile,
  requireInstructionsFile,
  requireRulesDirectory,
  requireToolInstructionsLayout,
  type ToolInstructionsLayout,
  toolInstructionsLayoutFor,
} from "../shared/toolInstructions";
import type {
  SaveToolInstructionsFileInput,
  ToolConfig,
  ToolInstructionsDocument,
  ToolInstructionsFile,
} from "../shared/types";
import { normalizeMarkdownFileName } from "./creation";
import { ensureDirectory, listRelativeFiles, pathExists, validatePathSegment } from "./fs";
import { isNativeAbsolutePath, resolveUserPath } from "./paths";

type ListedFile = Omit<ToolInstructionsFile, "content" | "exists">;

export type ToolInstructionsSnapshotEntry = {
  toolId: string;
  relativePath: string;
  content: string;
};

const locateNativeFile: LocateInstructionsFile = (instructionsPath) => {
  // Paths from another OS (e.g. synced settings) are unusable here.
  if (!isNativeAbsolutePath(instructionsPath)) return null;
  const mainPath = resolveUserPath(instructionsPath);
  return { directory: path.dirname(mainPath), mainFile: path.basename(mainPath) };
};

/** Where a tool's instruction files live on this machine, or null when it has none here. */
export function toolInstructionsLayout(tool: ToolConfig) {
  return toolInstructionsLayoutFor(tool, locateNativeFile);
}

function absolutePathFor(layout: ToolInstructionsLayout, relativePath: string) {
  return path.join(layout.directory, ...relativePath.split("/"));
}

function withAbsolutePath(layout: ToolInstructionsLayout, file: InstructionsFileRef): ListedFile {
  return { ...file, absolutePath: absolutePathFor(layout, file.relativePath) };
}

function resolveInstructionsFile(layout: ToolInstructionsLayout, relativePath: string) {
  return withAbsolutePath(layout, requireInstructionsFile(layout, relativePath));
}

async function readOptionalFile(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function listRuleFiles(layout: ToolInstructionsLayout): Promise<ListedFile[]> {
  if (!layout.rulesDirectory) return [];
  const rulesRoot = absolutePathFor(layout, layout.rulesDirectory);
  if (!(await pathExists(rulesRoot))) return [];
  const relativeFiles = await listRelativeFiles(rulesRoot);
  return relativeFiles
    .map(toPortablePath)
    .filter(isMarkdownPath)
    .map((relativePath) =>
      resolveInstructionsFile(layout, `${layout.rulesDirectory}/${relativePath}`)
    );
}

/** The main file always, plus the override and rules that currently exist. */
async function listInstructionsFiles(layout: ToolInstructionsLayout): Promise<ListedFile[]> {
  const files = [resolveInstructionsFile(layout, layout.mainFile)];
  if (layout.overrideFile) {
    const override = resolveInstructionsFile(layout, layout.overrideFile);
    if (await pathExists(override.absolutePath)) files.push(override);
  }
  files.push(...(await listRuleFiles(layout)));
  return files;
}

async function readInstructionsFiles(
  layout: ToolInstructionsLayout
): Promise<ToolInstructionsFile[]> {
  return Promise.all(
    (await listInstructionsFiles(layout)).map(async (file) => {
      const content = await readOptionalFile(file.absolutePath);
      return { ...file, exists: content !== null, content: content ?? "" };
    })
  );
}

/**
 * Writes in place instead of via temp-file-and-rename so a symlinked instructions file (e.g.
 * CLAUDE.md kept in a dotfiles repo) stays a link to the user's own copy.
 */
async function writeInPlace(filePath: string, content: string) {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, content, "utf8");
}

export async function readToolInstructions(tool: ToolConfig): Promise<ToolInstructionsDocument> {
  const layout = requireToolInstructionsLayout(tool, locateNativeFile);
  return {
    toolId: tool.id,
    toolName: tool.name,
    directory: layout.directory,
    files: await readInstructionsFiles(layout),
    rulesDirectory: layout.rulesDirectory,
  };
}

/**
 * Saves edited files unless one of them changed on disk since it was opened; tools such as
 * Claude Code edit these files themselves. `overwrite` skips that check once the user confirmed.
 */
export async function saveToolInstructions(
  tool: ToolConfig,
  files: SaveToolInstructionsFileInput[],
  { overwrite = false }: { overwrite?: boolean } = {}
) {
  const layout = requireToolInstructionsLayout(tool, locateNativeFile);
  const targets = files.map((file) => ({
    ...file,
    target: resolveInstructionsFile(layout, file.relativePath),
  }));

  if (!overwrite) {
    const changedPaths: string[] = [];
    for (const file of targets) {
      const current = await readOptionalFile(file.target.absolutePath);
      if (current !== file.baseContent) changedPaths.push(file.target.relativePath);
    }
    if (changedPaths.length > 0) throw instructionsChangedError(changedPaths);
  }

  for (const file of targets) {
    await writeInPlace(file.target.absolutePath, file.content);
  }
  return readToolInstructions(tool);
}

/** Creates an empty rule file and returns the refreshed document plus the new file's path. */
export async function createToolInstructionsRule(tool: ToolConfig, name: string) {
  const layout = requireToolInstructionsLayout(tool, locateNativeFile);
  const rulesDirectory = requireRulesDirectory(tool, layout);
  const fileName = validatePathSegment(normalizeMarkdownFileName(name), "File name");
  const target = resolveInstructionsFile(layout, `${rulesDirectory}/${fileName}`);
  if (await pathExists(target.absolutePath)) {
    throw new AppError("file-exists", "A file with that name already exists.", {
      path: target.absolutePath,
    });
  }
  await writeInPlace(target.absolutePath, "");
  return { document: await readToolInstructions(tool), relativePath: target.relativePath };
}

function snapshotToolDirectory(snapshotRoot: string, toolId: string) {
  try {
    return path.join(snapshotRoot, validatePathSegment(toolId, "Tool id"));
  } catch {
    return null;
  }
}

/** Replaces `snapshotRoot` with a copy of every tool's existing instruction files. */
export async function writeToolInstructionsSnapshot(tools: ToolConfig[], snapshotRoot: string) {
  await rm(snapshotRoot, { recursive: true, force: true });
  for (const tool of tools) {
    const layout = toolInstructionsLayout(tool);
    const toolDirectory = snapshotToolDirectory(snapshotRoot, tool.id);
    if (!layout || !toolDirectory) continue;
    for (const file of await readInstructionsFiles(layout)) {
      if (!file.exists) continue;
      await writeInPlace(path.join(toolDirectory, ...file.relativePath.split("/")), file.content);
    }
  }
}

/** Reads a snapshot written by `writeToolInstructionsSnapshot`. */
export async function readToolInstructionsSnapshot(
  snapshotRoot: string
): Promise<ToolInstructionsSnapshotEntry[]> {
  if (!(await pathExists(snapshotRoot))) return [];
  const entries: ToolInstructionsSnapshotEntry[] = [];
  for (const dirent of await readdir(snapshotRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const toolDirectory = path.join(snapshotRoot, dirent.name);
    for (const relativePath of await listRelativeFiles(toolDirectory)) {
      entries.push({
        toolId: dirent.name,
        relativePath: toPortablePath(relativePath),
        content: await readFile(path.join(toolDirectory, relativePath), "utf8"),
      });
    }
  }
  return entries;
}

function snapshotTargets(tools: ToolConfig[], entries: ToolInstructionsSnapshotEntry[]) {
  const toolsById = new Map(tools.map((tool) => [tool.id, tool]));
  return entries.flatMap((entry) => {
    const tool = toolsById.get(entry.toolId);
    const layout = tool ? toolInstructionsLayout(tool) : null;
    if (!layout) return [];
    const file = classifyInstructionsFile(layout, entry.relativePath);
    return file ? [{ entry, target: withAbsolutePath(layout, file) }] : [];
  });
}

/** Local files a restore would overwrite with different content. */
export async function toolInstructionsConflicts(
  tools: ToolConfig[],
  entries: ToolInstructionsSnapshotEntry[]
) {
  const conflicts: string[] = [];
  for (const { entry, target } of snapshotTargets(tools, entries)) {
    const current = await readOptionalFile(target.absolutePath);
    if (current !== null && current !== entry.content) conflicts.push(target.absolutePath);
  }
  return conflicts;
}

/**
 * Writes snapshot entries back to each tool's files on this machine. Entries for tools that are
 * not configured, or paths that are not instruction files, are skipped.
 */
export async function applyToolInstructionsSnapshot(
  tools: ToolConfig[],
  entries: ToolInstructionsSnapshotEntry[]
) {
  const written: string[] = [];
  for (const { entry, target } of snapshotTargets(tools, entries)) {
    await writeInPlace(target.absolutePath, entry.content);
    written.push(target.absolutePath);
  }
  return written;
}
