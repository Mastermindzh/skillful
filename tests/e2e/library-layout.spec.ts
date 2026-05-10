import { expect, test } from "@playwright/test";
import { baseFixture, launchLayoutFixture } from "./fixtures";
import { gotoApp } from "./support/app";

test("keeps library kind badges fully visible on launch", async ({ page }) => {
  await gotoApp(page, launchLayoutFixture);

  const option = page.getByRole("option", {
    name: /Extremely long launch layout skill name that should leave room for the kind badge/i,
  });
  const badge = option.getByText("Skill", { exact: true });

  await expect(option).toBeVisible();
  await expect(badge).toBeVisible();

  const [optionBox, badgeBox] = await Promise.all([option.boundingBox(), badge.boundingBox()]);
  if (!optionBox || !badgeBox) {
    throw new Error("Expected the list option and kind badge to have layout boxes.");
  }

  expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(optionBox.x + optionBox.width);
});

test("keeps the list header count visible when space is tight", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 620 });
  await gotoApp(page, {
    ...baseFixture,
    collections: [{ id: "github-copilot", title: "GitHub Copilot" }],
    documents: [],
  });

  await page.getByRole("button", { name: /GitHub Copilot\s+0/i }).click();

  const listPane = page.locator(".list-pane");
  const countBadge = listPane.locator(".list-pane-count-badge", { hasText: "0" });
  const actions = listPane.locator(".list-pane-header-actions");
  const heading = listPane.locator(".list-pane-heading-copy");

  await expect(countBadge).toBeVisible();

  const [paneBox, countBox, actionsBox, headingBox] = await Promise.all([
    listPane.boundingBox(),
    countBadge.boundingBox(),
    actions.boundingBox(),
    heading.boundingBox(),
  ]);
  if (!paneBox || !countBox || !actionsBox || !headingBox) {
    throw new Error("Expected the list pane header elements to have layout boxes.");
  }

  expect(countBox.x).toBeGreaterThanOrEqual(paneBox.x);
  expect(countBox.x + countBox.width).toBeLessThanOrEqual(paneBox.x + paneBox.width);
  expect(headingBox.x + headingBox.width).toBeLessThanOrEqual(actionsBox.x);
});
