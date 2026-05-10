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

export type ToolPreset = {
  id: ToolPresetId;
  name: string;
  icon: ToolIconKey;
  installRootsByPlatform: Partial<Record<SupportedToolPlatform, ToolPresetInstallRoots>>;
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
  };
}
