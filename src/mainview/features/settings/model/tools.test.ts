import { describe, expect, it } from "vitest";
import { availableToolPresets, validateToolRows } from "./tools";

describe("validateToolRows", () => {
  it("allows a tool to use the same install folder for skills and agents", () => {
    const validation = validateToolRows([
      {
        id: "opencode",
        name: "opencode",
        skillInstallRoot: "/home/test/.config/opencode/skills",
        agentInstallRoot: "/home/test/.config/opencode/skills",
        instructionsPath: "~/.config/opencode/AGENTS.md",
      },
    ]);

    expect(validation.hasErrors).toBe(false);
    expect(validation.byId.opencode).toBeNull();
    expect(validation.tools).toEqual([
      {
        id: "opencode",
        name: "opencode",
        installRoots: {
          skill: ["/home/test/.config/opencode/skills"],
          agent: ["/home/test/.config/opencode/skills"],
        },
        instructionsPath: "~/.config/opencode/AGENTS.md",
      },
    ]);
  });

  it("excludes rows marked for removal from the saved tools and never blocks save", () => {
    const validation = validateToolRows([
      {
        id: "saved",
        name: "saved",
        skillInstallRoot: "/abs/skills",
        agentInstallRoot: "",
        instructionsPath: "",
      },
      {
        // Pending row missing required fields would normally fail validation.
        id: "pending",
        name: "",
        skillInstallRoot: "",
        agentInstallRoot: "",
        instructionsPath: "",
        pendingRemoval: true,
      },
    ]);

    expect(validation.hasErrors).toBe(false);
    expect(validation.byId.pending).toBeNull();
    expect(validation.tools.map((tool) => tool.id)).toEqual(["saved"]);
  });

  it("rejects a relative instructions file but allows none", () => {
    const validation = validateToolRows([
      {
        id: "relative",
        name: "relative",
        skillInstallRoot: "/abs/skills",
        agentInstallRoot: "",
        instructionsPath: "CLAUDE.md",
      },
      {
        id: "none",
        name: "none",
        skillInstallRoot: "/abs/other",
        agentInstallRoot: "",
        instructionsPath: "  ",
      },
    ]);

    expect(validation.byId.relative?.instructionsPath).toBe("settings.error.absolutePath");
    expect(
      validateToolRows([
        {
          id: "shell",
          name: "shell",
          skillInstallRoot: "/abs/skills",
          agentInstallRoot: "",
          instructionsPath: "~/.bashrc",
        },
      ]).byId.shell?.instructionsPath
    ).toBe("settings.tools.error.instructionsMarkdown");
    expect(validation.byId.none).toBeNull();
  });
});

describe("availableToolPresets", () => {
  it("frees up a preset slot when its row is marked for removal", () => {
    const presetIds = availableToolPresets([
      {
        id: "claude-code",
        name: "Claude Code",
        skillInstallRoot: "/abs/skills",
        agentInstallRoot: "",
        instructionsPath: "",
        pendingRemoval: true,
      },
    ]).map((preset) => preset.id);

    expect(presetIds).toContain("claude-code");
  });
});
