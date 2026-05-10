import { expect, test } from "@playwright/test";
import { baseFixture } from "./fixtures";
import { gotoApp, selectItem } from "./support/app";

test("adds a markdown file", async ({ page }) => {
  await gotoApp(page);

  await selectItem(page, /Review PR/i);
  await page.getByLabel("Create markdown file").click();

  await expect(page.getByRole("dialog", { name: "New markdown file" })).toBeVisible();
  await page.getByLabel("File name").fill("retrospective");
  await page.getByRole("button", { name: "Create file" }).click();

  await expect(page.getByRole("tab", { name: /retrospective\.md/i })).toBeVisible();
});

test("opens a new markdown file in edit mode", async ({ page }) => {
  await gotoApp(page);

  await selectItem(page, /Review PR/i);
  await page.getByLabel("Create markdown file").click();

  await expect(page.getByRole("dialog", { name: "New markdown file" })).toBeVisible();
  await page.getByLabel("File name").fill("retrospective");
  await page.getByRole("button", { name: "Create file" }).click();

  // Wait for the new tab to attach first; the edit-mode flip happens via a
  // `viewModeIntent` effect that runs after the new document becomes active, so
  // polling for the tab avoids racing that transition.
  await expect(page.getByRole("tab", { name: /retrospective\.md/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview" })).toBeVisible();
});

test("toggles between preview and edit mode for the active file", async ({ page }) => {
  await gotoApp(page);

  await selectItem(page, /Review PR/i);
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(page.locator("h1", { hasText: "Review PR" })).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("button", { name: "Preview" })).toBeVisible();

  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
});

test("honors the default editor mode setting", async ({ page }) => {
  await gotoApp(page, {
    ...baseFixture,
    settings: {
      ...baseFixture.settings,
      defaultEditorMode: "edit",
    },
  });

  await selectItem(page, /Review PR/i);
  await expect(page.getByRole("button", { name: "Preview" })).toBeVisible();
});

test("keeps manual preview mode when the active item refreshes", async ({ page }) => {
  await gotoApp(page, {
    ...baseFixture,
    settings: {
      ...baseFixture.settings,
      defaultEditorMode: "edit",
    },
  });

  await selectItem(page, /Review PR/i);
  await expect(page.getByRole("button", { name: "Preview" })).toBeVisible();

  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();

  await page.evaluate(async () => {
    const libraryItems = await window.__SKILLFUL_E2E_BRIDGE__?.request.listLibraryItems();
    window.__SKILLFUL_E2E_EVENTS__?.emitLibraryItemsUpdated({
      libraryItems: libraryItems ?? [],
      reason: "test-refresh",
    });
  });

  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
});

test("shows a warning toast when saving entry frontmatter without description", async ({
  page,
}) => {
  await gotoApp(page, baseFixture);

  await selectItem(page, /Review PR/i);
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("button", { name: "Preview" })).toBeVisible();

  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.insertText(
    ["---", "name: Review PR", "---", "", "# Review PR", "", "Edited body.", ""].join("\n")
  );
  await expect(page.getByRole("button", { name: "Save all" })).toBeEnabled();
  const metadataWarnings = page.getByRole("status", { name: "Metadata needs attention" });
  await expect(metadataWarnings).toContainText("Missing frontmatter description.");

  await page.getByRole("button", { name: "Save all" }).click();

  const warning = page.locator(".app-notification").filter({ hasText: "Metadata warning" });
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("Missing frontmatter description.");
  await expect(metadataWarnings).toContainText("Missing frontmatter description.");
});
