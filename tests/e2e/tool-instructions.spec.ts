import { expect, type Page, test } from "@playwright/test";
import type { MockFixture } from "../../src/mainview/test-runtime/bridge";
import { agentInstallRootsFixture } from "./fixtures";
import { gotoApp, openSettings, selectItem } from "./support/app";

const instructionsFixture: MockFixture = {
  ...agentInstallRootsFixture,
  toolInstructions: {
    "claude-code": {
      "CLAUDE.md": "# Personal\n\nUse bun.\n",
      "rules/git.md": "Commit small.\n",
    },
    codex: {
      "AGENTS.md": "Codex main.\n",
      "AGENTS.override.md": "Codex override.\n",
    },
  },
};

async function openClaudeInstructions(page: Page) {
  await page.getByRole("button", { name: /Claude Code\s+\d+/i }).click();
  await page.getByRole("button", { name: "Edit Claude Code instructions" }).click();
  await expect(page.getByRole("heading", { name: "Claude Code instructions" })).toBeVisible();
}

async function replaceEditorText(page: Page, text: string) {
  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.insertText(text);
}

async function fileOnDisk(page: Page, toolId: string, relativePath: string) {
  return page.evaluate(
    async ({ toolId, relativePath }) => {
      const document = await window.__SKILLFUL_E2E_BRIDGE__?.request.readToolInstructions({
        toolId,
      });
      return document?.files.find((file) => file.relativePath === relativePath)?.content;
    },
    { toolId, relativePath }
  );
}

test("opens a tool's instructions and rules from the list header", async ({ page }) => {
  await gotoApp(page, instructionsFixture);
  await openClaudeInstructions(page);

  await expect(page.getByRole("tab", { name: "CLAUDE.md" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "rules/git.md" })).toBeVisible();
  await expect(page.getByText("Use bun.")).toBeVisible();

  await page.getByRole("tab", { name: "rules/git.md" }).click();
  await expect(page.getByText("Commit small.")).toBeVisible();
});

test("saves edits in place", async ({ page }) => {
  await gotoApp(page, instructionsFixture);
  await openClaudeInstructions(page);

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await replaceEditorText(page, "# Personal\n\nUse pnpm.\n");
  await page.getByRole("button", { name: "Save all" }).click();

  await expect(page.getByRole("button", { name: "Save all" })).toBeDisabled();
  expect(await fileOnDisk(page, "claude-code", "CLAUDE.md")).toBe("# Personal\n\nUse pnpm.\n");
});

test("asks before overwriting a file that changed outside Skillful", async ({ page }) => {
  await gotoApp(page, instructionsFixture);
  await openClaudeInstructions(page);

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await replaceEditorText(page, "Mine.\n");
  await page.evaluate(() =>
    window.__SKILLFUL_E2E_BRIDGE__?.request.saveToolInstructions({
      toolId: "claude-code",
      files: [{ relativePath: "CLAUDE.md", content: "Theirs.\n", baseContent: null }],
      overwrite: true,
    })
  );
  await page.getByRole("button", { name: "Save all" }).click();

  const dialog = page.getByRole("dialog", { name: "Changed outside Skillful" });
  await expect(dialog).toContainText("CLAUDE.md");
  await dialog.getByRole("button", { name: "Use their version" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.locator(".cm-content")).toContainText("Theirs.");
  expect(await fileOnDisk(page, "claude-code", "CLAUDE.md")).toBe("Theirs.\n");
});

test("creates a rule file", async ({ page }) => {
  await gotoApp(page, instructionsFixture);
  await openClaudeInstructions(page);

  await page.getByRole("button", { name: "New rule file" }).click();
  await page.getByLabel("File name").fill("testing");
  await page.getByRole("button", { name: "Create file" }).click();

  await expect(page.getByRole("tab", { name: "rules/testing.md" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.getByRole("button", { name: "Preview" })).toBeVisible();
});

test("warns that an existing Codex override hides AGENTS.md", async ({ page }) => {
  await gotoApp(page, instructionsFixture);
  await page.getByRole("button", { name: /Codex\s+\d+/i }).click();
  await page.getByRole("button", { name: "Edit Codex instructions" }).click();

  await expect(page.getByRole("status")).toContainText(
    "AGENTS.override.md exists, so AGENTS.md is ignored."
  );
});

test("opens instructions from settings after discarding unsaved settings", async ({ page }) => {
  await gotoApp(page, instructionsFixture);

  const dialog = await openSettings(page, "tools");
  await dialog.getByRole("button", { name: "Codex" }).click();
  const codex = dialog.getByLabel("Codex");
  await codex.getByRole("textbox", { name: "Tool name" }).fill("Codex CLI");
  await codex.getByRole("button", { name: "Edit instructions" }).click();

  const unsaved = page.getByRole("dialog", { name: "Unsaved changes" });
  await unsaved.getByRole("button", { name: "Discard" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Codex instructions" })).toBeVisible();
});

test("selecting a library item leaves the instructions view", async ({ page }) => {
  await gotoApp(page, instructionsFixture);
  await openClaudeInstructions(page);

  await page.getByRole("button", { name: /All\s+\d+/i }).click();
  await selectItem(page, /Review PR/i);

  await expect(page.getByRole("heading", { name: "Claude Code instructions" })).toBeHidden();
  await expect(page.locator("h1", { hasText: "Review PR" })).toBeVisible();
});

test("shows a newly created item instead of the instructions", async ({ page }) => {
  await gotoApp(page, instructionsFixture);
  await openClaudeInstructions(page);
  await page.getByRole("button", { name: /All\s+\d+/i }).click();

  await page.getByLabel("Create item").click();
  await page.getByLabel("Skill name").fill("Review Async Bundles");
  await page.getByLabel("Description").fill("Helps debug async bundler tasks.");
  await page.getByRole("button", { name: "Create skill" }).click();

  await expect(page.getByRole("heading", { name: "Claude Code instructions" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Review Async Bundles" })).toBeVisible();
});
