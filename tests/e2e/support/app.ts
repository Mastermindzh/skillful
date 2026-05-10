import { expect, type Locator, type Page } from "@playwright/test";
import type { MockFixture } from "../../../src/mainview/test-runtime/bridge";
import { baseFixture } from "../fixtures";

export async function gotoApp(page: Page, fixture: MockFixture = baseFixture) {
  await page.addInitScript((seed) => {
    (
      window as typeof window & { __SKILLFUL_E2E_FIXTURE__?: typeof seed }
    ).__SKILLFUL_E2E_FIXTURE__ = seed;
  }, fixture);
  await page.goto("/");
  if (fixture.pendingGitHubImport) {
    await page.evaluate((payload) => {
      window.__SKILLFUL_E2E_EVENTS__?.emitGitHubImportRequested(payload);
    }, fixture.pendingGitHubImport);
  }
}

export function libraryItemOption(page: Page, name: RegExp | string) {
  return page.getByRole("option", { name });
}

export async function selectItem(page: Page, name: RegExp | string) {
  await libraryItemOption(page, name).click();
}

export async function rightClickItem(page: Page, name: RegExp | string) {
  await libraryItemOption(page, name).click({ button: "right" });
}

export async function pressAppShortcut(page: Page, key: string) {
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.down(modifier);
  await page.keyboard.press(key);
  await page.keyboard.up(modifier);
}

export function settingsDialog(page: Page) {
  return page.getByRole("dialog", { name: "Settings" });
}

export function newItemDialog(page: Page) {
  return page.getByRole("dialog", { name: "New item" });
}

export async function openSettings(
  page: Page,
  tab: "general" | "library" | "tools" | "updates" = "library"
) {
  await page.getByLabel("Open settings").click();
  const dialog = settingsDialog(page);
  await expect(dialog).toBeVisible();

  if (tab !== "library") {
    await dialog.getByRole("tab", { name: tab[0].toUpperCase() + tab.slice(1) }).click();
  }

  return dialog;
}

export function libraryPanel(page: Page): Locator {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: "All" }) });
}

export async function openUpdatesSettings(page: Page) {
  await page.getByLabel("Update available").click();
  const dialog = settingsDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "Updates" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  return dialog;
}
