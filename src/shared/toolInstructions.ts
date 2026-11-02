import { AppError } from "./errors";
import { isMarkdownPath, safePortableRelativePath } from "./paths";
import { toolPresetById } from "./toolPresets";
import type { ToolConfig, ToolInstructionsFileRole } from "./types";

/**
 * Where a tool's instruction files live. Shared by the main process and the e2e bridge so both
 * accept exactly the same files; only turning the configured path into a folder differs.
 */
export type ToolInstructionsLayout = {
  directory: string;
  mainFile: string;
  overrideFile: string | null;
  rulesDirectory: string | null;
};

export type InstructionsFileRef = { relativePath: string; role: ToolInstructionsFileRole };

/** Splits a configured instructions path into folder and file name, or null when unusable here. */
export type LocateInstructionsFile = (
  instructionsPath: string
) => { directory: string; mainFile: string } | null;

/**
 * Layout for `tool`, or null when it has no (markdown) instructions file. Override and rules come
 * from the preset, so custom tools only ever get their main file.
 */
export function toolInstructionsLayoutFor(
  tool: ToolConfig,
  locate: LocateInstructionsFile
): ToolInstructionsLayout | null {
  if (!tool.instructionsPath || !isMarkdownPath(tool.instructionsPath)) return null;
  const mainFile = locate(tool.instructionsPath);
  if (!mainFile) return null;
  const preset = toolPresetById(tool.id)?.instructions;
  return {
    ...mainFile,
    overrideFile: preset?.overrideFile ?? null,
    rulesDirectory: preset?.rulesDirectory ?? null,
  };
}

export function requireToolInstructionsLayout(tool: ToolConfig, locate: LocateInstructionsFile) {
  const layout = toolInstructionsLayoutFor(tool, locate);
  if (!layout) {
    throw new AppError("invalid-path", `${tool.name} has no instructions file on this system.`, {
      toolId: tool.id,
    });
  }
  return layout;
}

export function requireRulesDirectory(tool: ToolConfig, layout: ToolInstructionsLayout) {
  if (!layout.rulesDirectory) {
    throw new AppError("invalid-path", `${tool.name} does not support rule files.`);
  }
  return layout.rulesDirectory;
}

/**
 * Maps a relative path onto one of the tool's known instruction files, or null for anything else.
 * This whitelist is what keeps the UI and restored backups from writing outside those files.
 */
export function classifyInstructionsFile(
  layout: ToolInstructionsLayout,
  relativePath: string
): InstructionsFileRef | null {
  let normalized: string;
  try {
    normalized = safePortableRelativePath(relativePath, "Instructions file");
  } catch {
    return null;
  }

  if (normalized === layout.mainFile) return { relativePath: normalized, role: "main" };
  if (normalized === layout.overrideFile) return { relativePath: normalized, role: "override" };
  if (
    layout.rulesDirectory &&
    normalized.startsWith(`${layout.rulesDirectory}/`) &&
    isMarkdownPath(normalized) &&
    normalized.split("/").every(Boolean)
  ) {
    return { relativePath: normalized, role: "rule" };
  }
  return null;
}

export function requireInstructionsFile(layout: ToolInstructionsLayout, relativePath: string) {
  const file = classifyInstructionsFile(layout, relativePath);
  if (!file) {
    throw new AppError("invalid-path", `Not an instructions file for this tool: ${relativePath}`);
  }
  return file;
}

export function instructionsChangedError(paths: string[]) {
  return new AppError(
    "tool-instructions-changed",
    "Instructions changed outside Skillful since they were opened.",
    { paths }
  );
}
