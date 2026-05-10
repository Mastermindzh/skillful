import { expect, test } from "@playwright/test";
import { gotoApp, libraryItemOption, libraryPanel } from "./support/app";

test("filters items by kind", async ({ page }) => {
  await gotoApp(page);

  const filters = libraryPanel(page).getByRole("radiogroup").first();
  const releaseTriageAgent = libraryItemOption(page, /Release Triage Agent/i);
  const reviewPr = libraryItemOption(page, /Review PR/i);

  await filters.getByText("Agents", { exact: true }).click();
  await expect(releaseTriageAgent).toBeVisible();
  await expect(reviewPr).toHaveCount(0);

  await filters.getByText("Skills", { exact: true }).click();
  await expect(reviewPr).toBeVisible();
  await expect(releaseTriageAgent).toHaveCount(0);
});

test("filters items by search query", async ({ page }) => {
  await gotoApp(page);

  const reviewPr = libraryItemOption(page, /Review PR/i);

  await expect(reviewPr).toBeVisible();
  await page.getByPlaceholder("Search items").fill("review");
  await expect(reviewPr).toBeVisible();

  await page.getByPlaceholder("Search items").fill("agent");
  await expect(page.getByText("No items found")).toHaveCount(0);
  await expect(reviewPr).toHaveCount(0);
  await expect(libraryItemOption(page, /Release Triage Agent/i)).toBeVisible();
});

test("clears the search query from the search field", async ({ page }) => {
  await gotoApp(page);

  const search = page.getByPlaceholder("Search items");
  await search.fill("review");
  await expect(libraryItemOption(page, /Release Triage Agent/i)).toHaveCount(0);

  await page.getByLabel("Clear search").click();

  await expect(search).toHaveValue("");
  await expect(libraryItemOption(page, /Release Triage Agent/i)).toBeVisible();
});
