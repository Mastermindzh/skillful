import { TOOL_PRESETS, type ToolPreset } from "../../../../shared/toolPresets";
import type { ToolConfig } from "../../../../shared/types";
import type { TranslationKey } from "../../../i18n/messages";
import { cleanPath, isAbsolutePath } from "../utils/paths";

export type ToolRow = {
  id: string;
  name: string;
  skillInstallRoot: string;
  agentInstallRoot: string;
  /**
   * When true, the row is visibly marked for removal in the UI but still in the
   * editable list. The row is excluded from validation and from the saved tool
   * config; clicking Cancel restores it because rows are rebuilt from
   * `appSettings` on close.
   */
  pendingRemoval?: boolean;
};

export type ToolRowIssue = {
  name?: TranslationKey;
  skillInstallRoot?: TranslationKey;
  agentInstallRoot?: TranslationKey;
  installRoots?: TranslationKey;
};

type ToolValidation = {
  byId: Record<string, ToolRowIssue | null>;
  tools: ToolConfig[];
  hasErrors: boolean;
};

function cleanedName(value: string) {
  return value.trim();
}

export function createToolRow(): ToolRow {
  return {
    id: crypto.randomUUID(),
    name: "",
    skillInstallRoot: "",
    agentInstallRoot: "",
  };
}

export function availableToolPresets(rows: ToolRow[]) {
  // Rows marked for removal free up their preset slot: after Save they're gone,
  // and a re-add through Quick Add will restore the pending row instead.
  const activeRows = rows.filter((row) => !row.pendingRemoval);
  const usedIds = new Set(activeRows.map((row) => row.id));
  const usedNames = new Set(
    activeRows.map((row) => cleanedName(row.name).toLowerCase()).filter(Boolean)
  );
  return TOOL_PRESETS.filter(
    (preset) => !usedIds.has(preset.id) && !usedNames.has(preset.name.toLowerCase())
  );
}

export function toolRowFromPreset(
  preset: ToolPreset,
  installRoots = { skill: "", agent: "" }
): ToolRow {
  return {
    id: preset.id,
    name: preset.name,
    skillInstallRoot: installRoots.skill,
    agentInstallRoot: installRoots.agent,
  };
}

export function buildToolRows(tools: ToolConfig[]): ToolRow[] {
  return tools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    skillInstallRoot: tool.installRoots.skill[0] ?? "",
    agentInstallRoot: tool.installRoots.agent[0] ?? "",
  }));
}

/** Validates editable rows and returns the normalized tool config payload that can be saved. */
export function validateToolRows(rows: ToolRow[]): ToolValidation {
  const byId: Record<string, ToolRowIssue | null> = {};
  const seenNames = new Set<string>();
  const tools: ToolConfig[] = [];
  let hasErrors = false;

  for (const row of rows) {
    if (row.pendingRemoval) {
      // Pending rows are dropped on Save and must never block it.
      byId[row.id] = null;
      continue;
    }

    const name = cleanedName(row.name);
    const skillInstallRoot = cleanPath(row.skillInstallRoot);
    const agentInstallRoot = cleanPath(row.agentInstallRoot);
    const hasInstallRoot = Boolean(skillInstallRoot || agentInstallRoot);
    const issue: ToolRowIssue = {};

    if (!name && !hasInstallRoot) {
      byId[row.id] = null;
      continue;
    }

    if (!name) {
      issue.name = "settings.tools.error.nameRequired";
    }

    if (!hasInstallRoot) {
      issue.installRoots = "settings.tools.error.installRootRequired";
    }

    if (skillInstallRoot && !isAbsolutePath(skillInstallRoot)) {
      issue.skillInstallRoot = "settings.error.absolutePath";
    }

    if (agentInstallRoot && !isAbsolutePath(agentInstallRoot)) {
      issue.agentInstallRoot = "settings.error.absolutePath";
    }

    if (name) {
      const normalizedName = name.toLowerCase();
      if (seenNames.has(normalizedName)) {
        issue.name = "settings.tools.error.namesUnique";
      }
      seenNames.add(normalizedName);
    }

    if (issue.name || issue.installRoots || issue.skillInstallRoot || issue.agentInstallRoot) {
      byId[row.id] = issue;
      hasErrors = true;
      continue;
    }

    tools.push({
      id: row.id,
      name,
      installRoots: {
        skill: skillInstallRoot ? [skillInstallRoot] : [],
        agent: agentInstallRoot ? [agentInstallRoot] : [],
      },
    });
    byId[row.id] = null;
  }

  return { byId, tools, hasErrors };
}

/** Checks whether editable rows differ from the last saved tool config. */
export function sameTools(left: ToolConfig[], right: ToolConfig[]) {
  if (left.length !== right.length) return false;

  return left.every((tool, index) => {
    const other = right[index];
    return (
      tool.id === other.id &&
      tool.name === other.name &&
      tool.installRoots.skill.length === other.installRoots.skill.length &&
      tool.installRoots.agent.length === other.installRoots.agent.length &&
      tool.installRoots.skill.every(
        (installRoot, installIndex) => installRoot === other.installRoots.skill[installIndex]
      ) &&
      tool.installRoots.agent.every(
        (installRoot, installIndex) => installRoot === other.installRoots.agent[installIndex]
      )
    );
  });
}
