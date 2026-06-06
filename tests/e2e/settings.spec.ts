import { expect, test } from "@playwright/test";
import { agentInstallRootsFixture, baseFixture, missingToolParentFixture } from "./fixtures";
import { gotoApp, openSettings, selectItem } from "./support/app";

test("shows the GitHub Copilot preset in the tools settings tab", async ({ page }) => {
  await gotoApp(page, baseFixture);

  const dialog = await openSettings(page, "tools");
  const presetButton = dialog.getByRole("button", { name: "GitHub Copilot" });

  await expect(presetButton).toBeVisible();
  await expect(presetButton.locator("svg")).toHaveCount(2);
  await expect(dialog.getByRole("button", { name: "Junie" })).toBeVisible();
});

test("opens a newly added preset tool in settings", async ({ page }) => {
  await gotoApp(page, baseFixture);

  const dialog = await openSettings(page, "tools");
  await dialog.getByRole("button", { name: "GitHub Copilot" }).click();

  const skillFolder = dialog
    .getByLabel("GitHub Copilot")
    .getByRole("textbox", { name: "Skill install folder" });
  await expect(skillFolder).toHaveValue("/mock/home/.copilot/skills");
  await skillFolder.fill("/mock/home/custom/copilot/skills");
  await expect(skillFolder).toHaveValue("/mock/home/custom/copilot/skills");
  await expect(dialog.getByRole("button", { name: "GitHub Copilot" })).toBeVisible();
});

test("starts with no custom tool row until a tool is added", async ({ page }) => {
  await gotoApp(page, {
    ...baseFixture,
    settings: {
      ...baseFixture.settings,
      tools: [],
      toolMappings: [],
    },
  });

  const dialog = await openSettings(page, "tools");

  await expect(dialog.getByRole("button", { name: "Tool 1" })).toBeHidden();
  await dialog.getByRole("button", { name: "Add tool" }).click();
  await expect(dialog.getByRole("button", { name: "Tool 1" })).toBeVisible();
});

test("allows choosing an app language", async ({ page }) => {
  await gotoApp(page, baseFixture);

  const dialog = await openSettings(page, "general");
  await dialog.getByLabel("App language").selectOption("nl");

  const translatedDialog = page.getByRole("dialog", { name: "Instellingen" });
  await expect(
    translatedDialog.getByRole("button", { name: "Instellingen opslaan" })
  ).toBeEnabled();
});

test("allows choosing the default editor mode", async ({ page }) => {
  await gotoApp(page, baseFixture);

  const dialog = await openSettings(page, "general");
  await dialog.getByLabel("Open markdown files in").selectOption("edit");

  await expect(dialog.getByRole("button", { name: "Save settings" })).toBeEnabled();
});

test("allows changing close-to-tray behavior", async ({ page }) => {
  await gotoApp(page, baseFixture);

  const dialog = await openSettings(page, "general");
  await dialog.getByLabel("Minimize to app tray on close").check();

  await expect(dialog.getByRole("button", { name: "Save settings" })).toBeEnabled();
});

test("shows install controls for agents when a tool has agent install roots", async ({ page }) => {
  await gotoApp(page, agentInstallRootsFixture);

  await selectItem(page, /Release Triage Agent/i);

  const installControl = page.locator(".tool-install-control");
  await expect(installControl).toBeVisible();
  await expect(installControl.getByRole("button", { name: "Install" })).toBeVisible();

  await installControl.getByRole("button", { name: "Install" }).click();
  await expect(page.getByRole("menuitem", { name: /Claude Code/i })).toBeVisible();
});

test("asks before creating a missing tool parent folder during install", async ({ page }) => {
  await gotoApp(page, missingToolParentFixture);

  await selectItem(page, /Review PR/i);
  const installControl = page.locator(".tool-install-control");
  await installControl.getByRole("button", { name: "Install" }).click();
  await page.getByRole("menuitem", { name: /Missing Parent Tool/i }).click();

  const dialog = page.getByRole("dialog", { name: "Create missing folder?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("/mock/missing-tool", { exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "Create folder and retry" }).click();

  await expect(dialog).toBeHidden();
  await installControl.getByRole("button", { name: "Install" }).click();
  await expect(
    page.getByRole("menuitem", { name: /Missing Parent Tool.*Installed/i })
  ).toBeVisible();
});
