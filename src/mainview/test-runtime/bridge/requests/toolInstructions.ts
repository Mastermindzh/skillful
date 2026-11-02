import { AppError } from "../../../../shared/errors";
import {
  instructionsChangedError,
  type LocateInstructionsFile,
  requireInstructionsFile,
  requireRulesDirectory,
  requireToolInstructionsLayout,
} from "../../../../shared/toolInstructions";
import { findToolOrThrow } from "../../../../shared/tools";
import type {
  ToolConfig,
  ToolInstructionsDocument,
  ToolInstructionsFile,
} from "../../../../shared/types";
import { clone, state } from "../state";
import type { RequestClient } from "../types";

const locateMockFile: LocateInstructionsFile = (instructionsPath) => {
  const mainPath = instructionsPath.replace(/^~/, state.settings.homeDirectory);
  const separator = mainPath.lastIndexOf("/");
  return { directory: mainPath.slice(0, separator), mainFile: mainPath.slice(separator + 1) };
};

function toolOrThrow(toolId: string) {
  return findToolOrThrow(state.settings.tools, toolId);
}

function layoutFor(tool: ToolConfig) {
  return requireToolInstructionsLayout(tool, locateMockFile);
}

function filesOnDisk(toolId: string) {
  state.toolInstructions[toolId] ??= {};
  return state.toolInstructions[toolId];
}

function documentFor(tool: ToolConfig): ToolInstructionsDocument {
  const layout = layoutFor(tool);
  const disk = filesOnDisk(tool.id);
  const file = (relativePath: string): ToolInstructionsFile => ({
    relativePath,
    absolutePath: `${layout.directory}/${relativePath}`,
    role: requireInstructionsFile(layout, relativePath).role,
    exists: relativePath in disk,
    content: disk[relativePath] ?? "",
  });
  const rules = Object.keys(disk)
    .filter((relativePath) => relativePath.startsWith(`${layout.rulesDirectory}/`))
    .sort((left, right) => left.localeCompare(right));
  return {
    toolId: tool.id,
    toolName: tool.name,
    directory: layout.directory,
    files: [
      file(layout.mainFile),
      ...(layout.overrideFile && layout.overrideFile in disk ? [file(layout.overrideFile)] : []),
      ...rules.map(file),
    ],
    rulesDirectory: layout.rulesDirectory,
  };
}

export const toolInstructionRequests = {
  async readToolInstructions({ toolId }) {
    return clone(documentFor(toolOrThrow(toolId)));
  },
  async saveToolInstructions({ toolId, files, overwrite }) {
    const tool = toolOrThrow(toolId);
    const layout = layoutFor(tool);
    const disk = filesOnDisk(toolId);
    for (const file of files) requireInstructionsFile(layout, file.relativePath);
    const changedPaths = overwrite
      ? []
      : files
          .filter((file) => (disk[file.relativePath] ?? null) !== file.baseContent)
          .map((file) => file.relativePath);
    if (changedPaths.length > 0) throw instructionsChangedError(changedPaths);
    for (const file of files) disk[file.relativePath] = file.content;
    return clone(documentFor(tool));
  },
  async createToolInstructionsRule({ toolId, name }) {
    const tool = toolOrThrow(toolId);
    const rulesDirectory = requireRulesDirectory(tool, layoutFor(tool));
    const fileName = name.trim().endsWith(".md") ? name.trim() : `${name.trim()}.md`;
    const relativePath = `${rulesDirectory}/${fileName}`;
    const disk = filesOnDisk(toolId);
    if (relativePath in disk) {
      throw new AppError("file-exists", "A file with that name already exists.");
    }
    disk[relativePath] = "";
    return clone({ document: documentFor(tool), relativePath });
  },
} satisfies Pick<
  RequestClient,
  "readToolInstructions" | "saveToolInstructions" | "createToolInstructionsRule"
>;
