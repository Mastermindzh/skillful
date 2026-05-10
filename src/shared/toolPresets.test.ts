import { describe, expect, it } from "vitest";
import { presetInstallRoots, toolPresetById } from "./toolPresets";

function presetRoots(id: string) {
  const preset = toolPresetById(id);
  if (!preset) throw new Error(`Missing preset: ${id}`);
  return presetInstallRoots(preset, "/mock/home", "linux");
}

describe("tool presets", () => {
  it("resolves known user-scope install roots", () => {
    expect(presetRoots("cursor")).toEqual({
      skill: ["/mock/home/.cursor/skills"],
      agent: ["/mock/home/.agents/skills"],
    });
    expect(presetRoots("junie")).toEqual({
      skill: ["/mock/home/.junie/skills"],
      agent: ["/mock/home/.junie/skills"],
    });
    expect(presetRoots("gemini-cli")).toEqual({
      skill: ["/mock/home/.gemini/skills"],
      agent: ["/mock/home/.gemini/skills"],
    });
    expect(presetRoots("opencode")).toEqual({
      skill: ["/mock/home/.config/opencode/skills"],
      agent: ["/mock/home/.config/opencode/skills"],
    });
    expect(presetRoots("github-copilot")).toEqual({
      skill: ["/mock/home/.copilot/skills"],
      agent: ["/mock/home/.agents/skills"],
    });
    expect(presetRoots("codex")).toEqual({
      skill: ["/mock/home/.codex/skills"],
      agent: [],
    });
  });
});
