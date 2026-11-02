import type { LibraryItemKind, Platform } from "./types";

export type ToolPresetId =
  | "claude-code"
  | "codex"
  | "github-copilot"
  | "junie"
  | "cursor"
  | "gemini-cli"
  | "opencode";

export type ToolIconKey =
  | "claude"
  | "codex"
  | "cursor"
  | "gemini"
  | "github"
  | "junie"
  | "opencode"
  | "tool";
export type SupportedToolPlatform = "darwin" | "linux" | "win32";
type ToolPresetInstallRoots = Partial<Record<LibraryItemKind, string[]>>;

/**
 * Where a tool reads its always-loaded, user-level instructions. Paths are home-relative (`~/`) so
 * the same value works on every platform and survives a backup restore on another OS.
 */
export type ToolInstructionsPreset = {
  file: string;
  /** Sibling file that, when present, the tool loads instead of `file`. */
  overrideFile?: string;
  /** Folder next to `file` whose `*.md` files the tool also loads in every session. */
  rulesDirectory?: string;
};

export type ToolPreset = {
  id: ToolPresetId;
  name: string;
  icon: ToolIconKey;
  installRootsByPlatform: Partial<Record<SupportedToolPlatform, ToolPresetInstallRoots>>;
  /** Omitted for tools that keep user instructions outside the filesystem (e.g. Cursor..). */
  instructions?: ToolInstructionsPreset;
};

export const TOOL_PRESETS: ToolPreset[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    icon: "claude",
    installRootsByPlatform: {
      darwin: {
        skill: ["{home}/.claude/skills"],
        agent: ["{home}/.claude/agents"],
      },
      linux: {
        skill: ["{home}/.claude/skills"],
        agent: ["{home}/.claude/agents"],
      },
      win32: {
        skill: ["{home}/.claude/skills"],
        agent: ["{home}/.claude/agents"],
      },
    },
    instructions: { file: "~/.claude/CLAUDE.md", rulesDirectory: "rules" },
  },
  {
    id: "codex",
    name: "Codex",
    icon: "codex",
    installRootsByPlatform: {
      darwin: {
        skill: ["{home}/.codex/skills"],
        agent: [],
      },
      linux: {
        skill: ["{home}/.codex/skills"],
        agent: [],
      },
      win32: {
        skill: ["{home}/.codex/skills"],
        agent: [],
      },
    },
    instructions: { file: "~/.codex/AGENTS.md", overrideFile: "AGENTS.override.md" },
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    icon: "github",
    installRootsByPlatform: {
      darwin: {
        skill: ["{home}/.copilot/skills"],
        agent: ["{home}/.agents/skills"],
      },
      linux: {
        skill: ["{home}/.copilot/skills"],
        agent: ["{home}/.agents/skills"],
      },
      win32: {
        skill: ["{home}/.copilot/skills"],
        agent: ["{home}/.agents/skills"],
      },
    },
    instructions: { file: "~/.copilot/copilot-instructions.md" },
  },
  {
    id: "junie",
    name: "Junie",
    icon: "junie",
    installRootsByPlatform: {
      darwin: {
        skill: ["{home}/.junie/skills"],
        agent: ["{home}/.junie/skills"],
      },
      linux: {
        skill: ["{home}/.junie/skills"],
        agent: ["{home}/.junie/skills"],
      },
      win32: {
        skill: ["{home}/.junie/skills"],
        agent: ["{home}/.junie/skills"],
      },
    },
    instructions: { file: "~/.junie/AGENTS.md" },
  },
  {
    id: "cursor",
    name: "Cursor",
    icon: "cursor",
    installRootsByPlatform: {
      darwin: {
        skill: ["{home}/.cursor/skills"],
        agent: ["{home}/.agents/skills"],
      },
      linux: {
        skill: ["{home}/.cursor/skills"],
        agent: ["{home}/.agents/skills"],
      },
      win32: {
        skill: ["{home}/.cursor/skills"],
        agent: ["{home}/.agents/skills"],
      },
    },
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    icon: "gemini",
    installRootsByPlatform: {
      darwin: {
        skill: ["{home}/.gemini/skills"],
        agent: ["{home}/.gemini/skills"],
      },
      linux: {
        skill: ["{home}/.gemini/skills"],
        agent: ["{home}/.gemini/skills"],
      },
      win32: {
        skill: ["{home}/.gemini/skills"],
        agent: ["{home}/.gemini/skills"],
      },
    },
    instructions: { file: "~/.gemini/GEMINI.md" },
  },
  {
    id: "opencode",
    name: "OpenCode",
    icon: "opencode",
    installRootsByPlatform: {
      darwin: {
        skill: ["{home}/.config/opencode/skills"],
        agent: ["{home}/.config/opencode/skills"],
      },
      linux: {
        skill: ["{home}/.config/opencode/skills"],
        agent: ["{home}/.config/opencode/skills"],
      },
      win32: {
        skill: ["{home}/.config/opencode/skills"],
        agent: ["{home}/.config/opencode/skills"],
      },
    },
    instructions: { file: "~/.config/opencode/AGENTS.md" },
  },
];

function isSupportedToolPlatform(platform: Platform): platform is SupportedToolPlatform {
  return platform === "darwin" || platform === "linux" || platform === "win32";
}

export function toolPresetById(id: string) {
  return TOOL_PRESETS.find((preset) => preset.id === id) ?? null;
}

/**
 * Resolves a preset's declarative path templates into concrete install folders for the current OS.
 */
export function presetInstallRoots(preset: ToolPreset, homeDirectory: string, platform: Platform) {
  if (!isSupportedToolPlatform(platform)) return { skill: [], agent: [] };

  const roots = preset.installRootsByPlatform[platform] ?? {};

  return {
    skill: (roots.skill ?? []).map((entry) => entry.split("{home}").join(homeDirectory)),
    agent: (roots.agent ?? []).map((entry) => entry.split("{home}").join(homeDirectory)),
  };
}

export function presetToolConfig(preset: ToolPreset, homeDirectory: string, platform: Platform) {
  return {
    id: preset.id,
    name: preset.name,
    installRoots: presetInstallRoots(preset, homeDirectory, platform),
    instructionsPath: preset.instructions?.file ?? "",
  };
}

/** Default instructions file for a tool id, or "" for custom tools and tools without one. */
export function presetInstructionsPath(toolId: string) {
  return toolPresetById(toolId)?.instructions?.file ?? "";
}
