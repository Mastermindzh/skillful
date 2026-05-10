import { expect, test } from "@playwright/test";
import {
  emptyCollectionArchiveFixture,
  githubImportFixture,
  importedCollectionArchiveFixture,
  pendingGitHubImportFixture,
} from "./fixtures";
import { gotoApp, libraryItemOption } from "./support/app";

async function openImportCollectionModal(page: Parameters<typeof gotoApp>[0]) {
  await page.getByLabel("Collection actions").click();
  await page.getByRole("menuitem", { name: "Import collection" }).click();
  const dialog = page.getByRole("dialog", { name: "Import collection" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("imports a non-empty collection archive through the sidebar flow", async ({ page }) => {
  await gotoApp(page, importedCollectionArchiveFixture);

  const dialog = await openImportCollectionModal(page);
  await dialog.getByRole("button", { name: /Choose (?:folder|archive)/i }).click();
  await expect(dialog.getByLabel(/Source (?:folder|archive)/i)).toHaveValue(
    "/mock/archives/design-system-library.skillful.zip"
  );

  await dialog.getByLabel("Collection name").fill("Design System Library");
  await dialog.getByRole("button", { name: "Import collection" }).click();

  await expect(page.getByRole("button", { name: /Design System Library\s+1/i })).toBeVisible();
  await page.getByRole("button", { name: /Design System Library\s+1/i }).click();

  const importedItem = libraryItemOption(page, /Archive Checklist/i);
  await expect(importedItem).toBeVisible();
  await importedItem.click();

  await expect(
    page.getByLabel("SKILL.md").getByRole("heading", {
      name: "Archive Checklist",
    })
  ).toBeVisible();
  await expect(
    page.getByLabel("SKILL.md").getByText("Imported from an archive fixture.")
  ).toBeVisible();
});

test("shows an empty imported archive as an empty collection", async ({ page }) => {
  await gotoApp(page, emptyCollectionArchiveFixture);

  const dialog = await openImportCollectionModal(page);
  await dialog.getByRole("button", { name: /Choose (?:folder|archive)/i }).click();
  await expect(dialog.getByLabel(/Source (?:folder|archive)/i)).toHaveValue(
    "/mock/archives/empty-archive.skillful.zip"
  );

  await dialog.getByLabel("Collection name").fill("Empty Archive");
  await dialog.getByRole("button", { name: "Import collection" }).click();

  await expect(page.getByRole("button", { name: /Empty Archive\s+0/i })).toBeVisible();
  await page.getByRole("button", { name: /Empty Archive\s+0/i }).click();

  await expect(page.getByText("No items found")).toBeVisible();
  await expect(page.getByText("Try another collection, tool, kind, or search.")).toBeVisible();
});

test("imports a collection from GitHub through the shared import modal", async ({ page }) => {
  await gotoApp(page, githubImportFixture);

  const dialog = await openImportCollectionModal(page);
  await dialog.getByText("GitHub", { exact: true }).click();
  await dialog.getByLabel("Repository").fill("Mastermindzh/skillful-library");
  await dialog.getByRole("button", { name: "Advanced options" }).click();
  await dialog.getByLabel("Ref").fill("main");
  await dialog.getByLabel("Path").fill("skills/debug-checklist");
  await dialog.getByLabel("Collection name").fill("GitHub Imports");
  await dialog.getByRole("button", { name: "Import collection" }).click();

  await expect(page.getByRole("button", { name: /GitHub Imports\s+1/i })).toBeVisible();
  await page.getByRole("button", { name: /GitHub Imports\s+1/i }).click();

  const importedItem = libraryItemOption(page, /Debug Checklist/i);
  await expect(importedItem).toBeVisible();
  await importedItem.click();

  await expect(
    page.getByLabel("SKILL.md").getByRole("heading", {
      name: "Debug Checklist",
    })
  ).toBeVisible();
  await expect(page.getByLabel("SKILL.md").getByText("Imported from GitHub.")).toBeVisible();
});

test("opens the import modal prefilled from a deep link request", async ({ page }) => {
  await gotoApp(page, pendingGitHubImportFixture);

  const dialog = page.getByRole("dialog", { name: "Import collection" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Repository")).toBeVisible();
  await expect(dialog.getByLabel("Repository")).toHaveValue("Mastermindzh/skillful-library");
  await expect(dialog.getByLabel("Collection name")).toHaveValue("GitHub Imports");
  await expect(dialog.getByLabel("Ref")).toHaveValue("main");
  await expect(dialog.getByLabel("Path")).toHaveValue("skills/debug-checklist");
});

test("completes a GitHub import after a deep link prefill", async ({ page }) => {
  await gotoApp(page, pendingGitHubImportFixture);

  const dialog = page.getByRole("dialog", { name: "Import collection" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Repository")).toHaveValue("Mastermindzh/skillful-library");

  await dialog.getByRole("button", { name: "Import collection" }).click();

  await expect(page.getByRole("button", { name: /GitHub Imports\s+1/i })).toBeVisible();
  await page.getByRole("button", { name: /GitHub Imports\s+1/i }).click();

  const importedItem = libraryItemOption(page, /Debug Checklist/i);
  await expect(importedItem).toBeVisible();
  await importedItem.click();

  await expect(
    page.getByLabel("SKILL.md").getByRole("heading", {
      name: "Debug Checklist",
    })
  ).toBeVisible();
  await expect(page.getByLabel("SKILL.md").getByText("Imported from GitHub.")).toBeVisible();
});

test("exposes export from the collection action menu", async ({ page }) => {
  await gotoApp(page);

  await page.getByLabel("Manage Test Collection").click();

  const exportItem = page.getByRole("menuitem", { name: "Export collection" });
  await expect(exportItem).toBeVisible();
  await exportItem.click();

  await expect(page.getByText("Collection exported")).toBeVisible();
  await expect(page.getByText(/Test Collection.*test-collection\.skillful\.zip/i)).toBeVisible();
});

test("exposes collection actions from the collection context menu", async ({ page }) => {
  await gotoApp(page);

  await page.getByRole("button", { name: /Test Collection\s+2/i }).click({
    button: "right",
  });

  await expect(page.getByRole("menuitem", { name: "Rename" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Export collection" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
});
