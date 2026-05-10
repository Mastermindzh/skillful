import { lstat, realpath, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { installFolderNameFromTitle } from "../shared/library";
import type {
  LibraryItemSummary,
  LibraryItemToolMapping,
  LibraryItemToolStatus,
  ToolConfig,
} from "../shared/types";
import { ensureDirectoryWithExistingParent, pathExists, realpathOrNull } from "./fs";
import { logger } from "./logger";

/** Returns the filesystem path that should be linked into a tool install folder. */
function skillSourcePath(libraryItem: LibraryItemSummary) {
  return libraryItem.rootPath;
}

function installName(libraryItem: LibraryItemSummary) {
  return installFolderNameFromTitle(libraryItem.title, path.basename(skillSourcePath(libraryItem)));
}

function installPath(root: string, libraryItem: LibraryItemSummary) {
  return path.join(root, installName(libraryItem));
}

function installRootsForSkill(tool: ToolConfig, libraryItem: LibraryItemSummary) {
  return tool.installRoots[libraryItem.kind] ?? [];
}

async function ensureSkillLink(root: string, libraryItem: LibraryItemSummary) {
  // Only create the leaf install folder. If the parent directory does not exist the tool is
  // either uninstalled or misconfigured -> surface the error instead of silently creating it.
  await ensureDirectoryWithExistingParent(root);

  const sourcePath = skillSourcePath(libraryItem);
  const sourceRealPath = await realpath(sourcePath);
  const destinationPath = installPath(root, libraryItem);

  // Never replace an unrelated file or folder. If the destination already resolves to this source,
  // treat it as already installed and leave it alone.
  if (await pathExists(destinationPath)) {
    const destinationRealPath = await realpathOrNull(destinationPath);
    if (destinationRealPath === sourceRealPath) {
      return destinationPath;
    }
    throw new Error(`Install path already exists: ${destinationPath}`);
  }

  const linkType = process.platform === "win32" ? "junction" : undefined;

  await symlink(sourcePath, destinationPath, linkType);
  return destinationPath;
}

/** Removes only links that still resolve back to the expected source libraryItem. */
async function removeSkillLink(root: string, libraryItem: LibraryItemSummary) {
  const sourceRealPath = await realpathOrNull(skillSourcePath(libraryItem));
  if (!sourceRealPath) return;
  const destinationPath = installPath(root, libraryItem);
  if (!(await pathExists(destinationPath))) return;
  const destinationRealPath = await realpathOrNull(destinationPath);
  if (destinationRealPath !== sourceRealPath) return;
  await rm(destinationPath, { recursive: true, force: false });
}

type InstallTarget = {
  toolId: string;
  root: string;
};

type InstallCheck = {
  root: string;
  state: "installed" | "missing" | "broken" | "conflict";
};

/** Derives install targets from tool mappings and each tool's configured install roots. */
function installTargetsForSkill(
  libraryItem: LibraryItemSummary,
  tools: ToolConfig[],
  mappings: LibraryItemToolMapping[]
): InstallTarget[] {
  const toolIds = mappings.find((mapping) => mapping.itemId === libraryItem.id)?.toolIds ?? [];
  const toolMap = new Map(tools.map((tool) => [tool.id, tool]));
  const targets: InstallTarget[] = [];

  for (const toolId of toolIds) {
    const tool = toolMap.get(toolId);
    if (!tool) continue;
    for (const root of installRootsForSkill(tool, libraryItem)) {
      targets.push({ toolId, root });
    }
  }

  return targets;
}

function targetKey(target: InstallTarget) {
  return `${target.toolId}:${target.root}`;
}

async function inspectSkillInstall(
  root: string,
  libraryItem: LibraryItemSummary
): Promise<InstallCheck> {
  const destinationPath = installPath(root, libraryItem);
  const destinationStats = await lstat(destinationPath).catch(() => null);
  if (!destinationStats) {
    return { root, state: "missing" };
  }

  const sourceRealPath = await realpathOrNull(skillSourcePath(libraryItem));
  const destinationRealPath = await realpathOrNull(destinationPath);
  if (sourceRealPath && destinationRealPath === sourceRealPath) {
    return { root, state: "installed" };
  }

  if (destinationStats.isSymbolicLink() || destinationRealPath === null) {
    return { root, state: "broken" };
  }

  return { root, state: "conflict" };
}

async function repairSkillLink(root: string, libraryItem: LibraryItemSummary) {
  await ensureDirectoryWithExistingParent(root);

  const destinationPath = installPath(root, libraryItem);
  const destinationStats = await lstat(destinationPath).catch(() => null);
  if (!destinationStats) {
    return ensureSkillLink(root, libraryItem);
  }

  const sourceRealPath = await realpathOrNull(skillSourcePath(libraryItem));
  const destinationRealPath = await realpathOrNull(destinationPath);

  if (sourceRealPath && destinationRealPath === sourceRealPath) {
    return destinationPath;
  }

  if (destinationStats.isSymbolicLink()) {
    await rm(destinationPath, { recursive: true, force: false });
    return ensureSkillLink(root, libraryItem);
  }

  throw new Error(`Install path already exists: ${destinationPath}`);
}

function statusDetails(state: LibraryItemToolStatus["state"]) {
  switch (state) {
    case "installed":
      return "Installed.";
    case "unmanaged":
      return "Found on disk.";
    case "broken":
      return "Install needs repair.";
    case "conflict":
      return "Install is blocked.";
    default:
      return "Not installed.";
  }
}

export async function syncLibraryItemInstalls(
  libraryItem: LibraryItemSummary,
  previousTools: ToolConfig[],
  previousMappings: LibraryItemToolMapping[],
  nextTools: ToolConfig[],
  nextMappings: LibraryItemToolMapping[]
) {
  // Apply adds first so a failed install does not accidentally drop an existing working link.
  const previousTargets = installTargetsForSkill(libraryItem, previousTools, previousMappings);
  const nextTargets = installTargetsForSkill(libraryItem, nextTools, nextMappings);

  const previousTargetMap = new Map(previousTargets.map((target) => [targetKey(target), target]));
  const nextTargetMap = new Map(nextTargets.map((target) => [targetKey(target), target]));

  const targetsToAdd = nextTargets.filter((target) => !previousTargetMap.has(targetKey(target)));
  const targetsToRemove = previousTargets.filter((target) => !nextTargetMap.has(targetKey(target)));

  const addedTargets: InstallTarget[] = [];

  try {
    for (const target of targetsToAdd) {
      await ensureSkillLink(target.root, libraryItem);
      addedTargets.push(target);
    }
  } catch (error) {
    const rollbackResults = await Promise.allSettled(
      addedTargets.map((target) => removeSkillLink(target.root, libraryItem))
    );
    for (const result of rollbackResults) {
      if (result.status === "rejected") {
        logger.error("Rollback failed while undoing added links.", result.reason);
      }
    }
    throw error;
  }

  const removedTargets: InstallTarget[] = [];

  try {
    for (const target of targetsToRemove) {
      await removeSkillLink(target.root, libraryItem);
      removedTargets.push(target);
    }
  } catch (error) {
    const undoResults = await Promise.allSettled([
      ...addedTargets.map((target) => removeSkillLink(target.root, libraryItem)),
      ...removedTargets.map((target) => ensureSkillLink(target.root, libraryItem)),
    ]);
    for (const result of undoResults) {
      if (result.status === "rejected") {
        logger.error("Rollback failed while restoring removed links.", result.reason);
      }
    }
    throw error;
  }
}

export async function getLibraryItemToolStatuses(
  libraryItem: LibraryItemSummary,
  tools: ToolConfig[],
  mappings: LibraryItemToolMapping[]
) {
  const mappedToolIds = new Set(
    mappings.find((mapping) => mapping.itemId === libraryItem.id)?.toolIds ?? []
  );

  const supportedTools = tools
    .map((tool) => ({
      tool,
      installRoots: installRootsForSkill(tool, libraryItem),
    }))
    .filter(({ installRoots }) => installRoots.length > 0);

  return Promise.all(
    supportedTools.map(async ({ tool, installRoots }): Promise<LibraryItemToolStatus> => {
      const checks = await Promise.all(
        installRoots.map((installRoot) => inspectSkillInstall(installRoot, libraryItem))
      );
      const workingRoots = checks
        .filter((check) => check.state === "installed")
        .map((check) => check.root);
      const problemRoots = checks
        .filter(
          (check) =>
            check.state === "missing" || check.state === "broken" || check.state === "conflict"
        )
        .map((check) => check.root);
      const mapped = mappedToolIds.has(tool.id);

      let state: LibraryItemToolStatus["state"] = "not-installed";
      if (checks.some((check) => check.state === "conflict")) {
        state = "conflict";
      } else if (mapped) {
        state = checks.every((check) => check.state === "installed") ? "installed" : "broken";
      } else if (checks.some((check) => check.state === "installed")) {
        state = "unmanaged";
      }

      return {
        toolId: tool.id,
        toolName: tool.name,
        mapped,
        state,
        installRoots: [...installRoots],
        workingRoots,
        problemRoots,
        details: statusDetails(state),
      };
    })
  );
}

export async function repairLibraryItemToolInstall(
  libraryItem: LibraryItemSummary,
  tool: ToolConfig
) {
  for (const installRoot of installRootsForSkill(tool, libraryItem)) {
    await repairSkillLink(installRoot, libraryItem);
  }
}
