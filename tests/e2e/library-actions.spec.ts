import { expect, test } from "@playwright/test";
import { gotoApp, pressAppShortcut, rightClickItem, selectItem } from "./support/app";

test.describe("library interactions", () => {
  test("exposes item actions from the item context menu", async ({ page }) => {
    await gotoApp(page);

    await rightClickItem(page, /Review PR/i);

    await expect(page.getByRole("menuitem", { name: "Open containing folder" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Rename selected" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Delete selected" })).toBeVisible();
  });

  test("does not open the item context menu on left click", async ({ page }) => {
    await gotoApp(page);

    await selectItem(page, /Review PR/i);

    await expect(page.getByRole("menuitem", { name: "Rename selected" })).toHaveCount(0);
  });

  test("focuses search with Ctrl or Cmd plus F", async ({ page }) => {
    await gotoApp(page);

    // The base fixture auto-loads an item into the editor, which steals focus;
    // CodeMirror intercepts Ctrl+F in that state and opens its own find panel.
    // Click the library section heading to move focus out of the editor before
    // pressing the global shortcut, mirroring how a user would invoke it.
    await page.getByRole("heading", { name: "All" }).first().click();
    await pressAppShortcut(page, "f");

    await expect(page.getByPlaceholder("Search items")).toBeFocused();
  });

  test("opens settings with Ctrl or Cmd plus comma", async ({ page }) => {
    await gotoApp(page);

    await pressAppShortcut(page, ",");

    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  });

  test("opens rename through F2 for the selected item", async ({ page }) => {
    await gotoApp(page);

    await selectItem(page, /Review PR/i);
    await page.keyboard.press("F2");

    await expect(page.getByRole("dialog", { name: /Rename skill/i })).toBeVisible();
  });

  test("opens shortcut help with Shift plus question mark", async ({ page }) => {
    await gotoApp(page);

    await page.keyboard.down("Shift");
    await page.keyboard.press("/");
    await page.keyboard.up("Shift");

    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await expect(page.getByText("Focus search")).toBeVisible();
  });
});
