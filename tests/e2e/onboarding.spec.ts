import { expect, test } from "@playwright/test";
import { baseFixture } from "./fixtures";
import { gotoApp } from "./support/app";

test("shows first-launch onboarding and lets the user skip it", async ({ page }) => {
  await gotoApp(page, {
    ...baseFixture,
    settings: {
      ...baseFixture.settings,
      onboardingTourCompleted: false,
    },
  });

  await expect(page.getByText("Start with a collection")).toBeVisible();

  await page.getByRole("button", { name: "Skip tour" }).click();

  await expect(page.getByText("Start with collections and tools")).toBeHidden();
});
