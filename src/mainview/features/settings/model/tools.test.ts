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
      },
      {
        // Pending row missing required fields would normally fail validation.
        id: "pending",
        name: "",
        skillInstallRoot: "",
        agentInstallRoot: "",
        pendingRemoval: true,
      },
    ]);

    expect(validation.hasErrors).toBe(false);
    expect(validation.byId.pending).toBeNull();
    expect(validation.tools.map((tool) => tool.id)).toEqual(["saved"]);
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
        pendingRemoval: true,
      },
    ]).map((preset) => preset.id);

    expect(presetIds).toContain("claude-code");
  });
});
