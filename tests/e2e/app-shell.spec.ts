import { expect, test } from "@playwright/test";
import { gotoApp, libraryItemOption, openUpdatesSettings } from "./support/app";

const appVersion = process.env.SKILLFUL_APP_VERSION ?? "0.0.0";

test("boots with seeded library data", async ({ page }) => {
  await gotoApp(page);
  const reviewPr = libraryItemOption(page, /Review PR/i);

  await expect(page.getByRole("heading", { name: "Skillful" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Test Collection 2" })).toBeVisible();
  await expect(reviewPr).toBeVisible();
  await reviewPr.click();
  await expect(page.locator("h1", { hasText: "Review PR" })).toBeVisible();
});

test("opens the updates settings panel from the update indicator", async ({ page }) => {
  await gotoApp(page);

  await expect(page.getByLabel("Update available")).toBeVisible();

  const dialog = await openUpdatesSettings(page);

  await expect(dialog.getByText("Current version:")).toBeVisible();
  await expect(dialog.getByText(appVersion)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Download update" })).toBeEnabled();
});

test("downloads an update and enables restart to apply", async ({ page }) => {
  await gotoApp(page);

  const dialog = await openUpdatesSettings(page);
  const downloadButton = dialog.getByRole("button", { name: "Download update" });
  const restartButton = dialog.getByRole("button", { name: "Restart to apply" });

  await expect(downloadButton).toBeEnabled();
  await expect(restartButton).toBeDisabled();
  await downloadButton.click();

  await expect(dialog.getByText("Update downloaded")).toBeVisible();
  await expect(restartButton).toBeEnabled();
  await expect(downloadButton).toBeDisabled();
});
