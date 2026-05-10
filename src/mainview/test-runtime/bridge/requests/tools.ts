import { AppError } from "../../../../shared/errors";
import { fixtureConfig } from "../fixtures";
import { clone, createdDirectories, state, toolStatusFor } from "../state";
import type { RequestClient } from "../types";

function installSkillToolMapping(itemId: string, toolId: string) {
  if (
    fixtureConfig.missingToolParentPath &&
    !createdDirectories.has(fixtureConfig.missingToolParentPath)
  ) {
    throw new AppError(
      "tool-install-missing-root",
      `Parent directory does not exist: ${fixtureConfig.missingToolParentPath}`,
      { path: fixtureConfig.missingToolParentPath }
    );
  }

  const mapping = state.settings.toolMappings.find((entry) => entry.itemId === itemId);
  if (mapping) {
    if (!mapping.toolIds.includes(toolId)) {
      mapping.toolIds.push(toolId);
    }
  } else {
    state.settings.toolMappings.push({ itemId, toolIds: [toolId] });
  }
  return clone(state.settings);
}

export const toolRequests = {
  async getLibraryItemToolStatuses({ itemId }) {
    return clone(
      state.settings.tools
        .map((tool) => toolStatusFor(tool, itemId))
        .filter((status) => status.installRoots.length > 0)
    );
  },
  async installLibraryItemTool({ itemId, toolId }) {
    return installSkillToolMapping(itemId, toolId);
  },
  async removeLibraryItemTool({ itemId, toolId }) {
    const mapping = state.settings.toolMappings.find((entry) => entry.itemId === itemId);
    if (mapping) {
      mapping.toolIds = mapping.toolIds.filter((entry) => entry !== toolId);
    }
    return clone(state.settings);
  },
  async repairLibraryItemTool({ itemId, toolId }) {
    return installSkillToolMapping(itemId, toolId);
  },
} satisfies Pick<
  RequestClient,
  | "getLibraryItemToolStatuses"
  | "installLibraryItemTool"
  | "removeLibraryItemTool"
  | "repairLibraryItemTool"
>;
