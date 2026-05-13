import { expect, test } from "@playwright/test";
import { gotoApp, libraryItemOption, newItemDialog, selectItem } from "./support/app";

test("creates a collection", async ({ page }) => {
  await gotoApp(page);

  await page.getByLabel("Collection actions").click();
  await page.getByRole("menuitem", { name: "New collection" }).click();

  await expect(page.getByRole("dialog", { name: "New collection" })).toBeVisible();
  await page.getByLabel("Collection name").fill("Launch");
  await page.getByRole("button", { name: "Create collection" }).click();

  await expect(page.getByRole("button", { name: "Launch 0" })).toBeVisible();
});

test("creates an agent in an existing collection", async ({ page }) => {
  await gotoApp(page);

  await page.getByLabel("Create item").click();
  const dialog = newItemDialog(page);
  await expect(dialog).toBeVisible();

  await dialog.locator('input[value="agent"]').evaluate((node) => {
    (node as HTMLInputElement).click();
  });
  await page.getByLabel("Agent name").fill("Design Critic Agent");
  await page.getByLabel("Description").fill("Reviews interface changes for clarity.");
  await page.getByRole("button", { name: "Create agent" }).click();

  await expect(libraryItemOption(page, /Design Critic Agent/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Design Critic Agent" })).toBeVisible();
  await expect(page.getByTitle("Reviews interface changes for clarity.")).toBeVisible();
  await expect(page.getByText("Item not found.")).toHaveCount(0);
  await expect(page.getByText(/^Skill not found:/)).toHaveCount(0);
});

test("creates a skill without surfacing a stale open-item error", async ({ page }) => {
  await gotoApp(page);

  await page.getByLabel("Create item").click();
  const dialog = newItemDialog(page);
  await expect(dialog).toBeVisible();

  await page.getByLabel("Skill name").fill("Review Async Bundles");
  await page.getByLabel("Description").fill("Helps debug async bundler tasks.");
  await page.getByRole("button", { name: "Create skill" }).click();

  await expect(libraryItemOption(page, /Review Async Bundles/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review Async Bundles" })).toBeVisible();
  await expect(page.getByText("Item not found.")).toHaveCount(0);
  await expect(page.getByText(/^Skill not found:/)).toHaveCount(0);
});

test("renames the selected skill through the management dialog", async ({ page }) => {
  await gotoApp(page);

  await selectItem(page, /Review PR/i);
  await page.getByLabel("Manage selected item").click();
  await page.getByRole("menuitem", { name: "Rename selected" }).click();

  const dialog = page.getByRole("dialog", { name: "Rename skill" });
  await expect(dialog).toBeVisible();
  await page.getByLabel("Skill name").fill("Review Pull Request");
  await page.getByRole("button", { name: "Rename skill" }).click();

  await expect(libraryItemOption(page, /Review Pull Request/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review Pull Request" })).toBeVisible();
});

test("moves the selected skill to another collection", async ({ page }) => {
  await gotoApp(page);

  await page.getByLabel("Collection actions").click();
  await page.getByRole("menuitem", { name: "New collection" }).click();
  await page.getByLabel("Collection name").fill("Alpha");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(page.getByRole("button", { name: "Alpha 0" })).toBeVisible();

  await page.getByLabel("Collection actions").click();
  await page.getByRole("menuitem", { name: "New collection" }).click();
  await page.getByLabel("Collection name").fill("Launch");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(page.getByRole("button", { name: "Launch 0" })).toBeVisible();

  await page.getByRole("button", { name: "Test Collection 2" }).click();
  await selectItem(page, /Review PR/i);
  await page.getByLabel("Manage selected item").click();
  await page.getByRole("menuitem", { name: "Move selected" }).click();

  const dialog = page.getByRole("dialog", { name: "Move skill" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Destination collection").click();
  await page.getByRole("option", { name: "Launch", exact: true }).click();
  await expect(dialog.getByLabel("Destination collection")).toHaveValue("Launch");
  await dialog.getByRole("button", { name: "Move skill" }).click();

  await expect(page.getByRole("heading", { name: "Launch" })).toBeVisible();
  await expect(libraryItemOption(page, /Review PR/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Launch 1" })).toBeVisible();
});

test("moves the selected agent without surfacing a stale open-item error", async ({ page }) => {
  await gotoApp(page);

  await page.getByLabel("Collection actions").click();
  await page.getByRole("menuitem", { name: "New collection" }).click();
  await page.getByLabel("Collection name").fill("Launch");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(page.getByRole("button", { name: "Launch 0" })).toBeVisible();

  await page.getByRole("button", { name: "Test Collection 2" }).click();
  await page
    .locator(".list-pane .mantine-SegmentedControl-label")
    .filter({ hasText: "Agents" })
    .click();
  await selectItem(page, /Release Triage Agent/i);
  await page.getByLabel("Manage selected item").click();
  await page.getByRole("menuitem", { name: "Move selected" }).click();

  const dialog = page.getByRole("dialog", { name: "Move agent" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Destination collection").click();
  await page.getByRole("option", { name: "Launch", exact: true }).click();
  await dialog.getByRole("button", { name: "Move agent" }).click();

  await expect(page.getByRole("heading", { name: "Launch" })).toBeVisible();
  await expect(libraryItemOption(page, /Release Triage Agent/i)).toBeVisible();
  await expect(page.getByText("Item not found.")).toHaveCount(0);
  await expect(page.getByText(/^Skill not found:/)).toHaveCount(0);
});

test("deletes the selected skill through the confirmation dialog", async ({ page }) => {
  await gotoApp(page);

  await selectItem(page, /Review PR/i);
  await page.getByLabel("Manage selected item").click();
  await page.getByRole("menuitem", { name: "Delete selected" }).click();

  const dialog = page.getByRole("dialog", { name: "Delete skill" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete" }).click();

  await expect(libraryItemOption(page, /Review PR/i)).toHaveCount(0);
  await expect(libraryItemOption(page, /Release Triage Agent/i)).toBeVisible();
});
