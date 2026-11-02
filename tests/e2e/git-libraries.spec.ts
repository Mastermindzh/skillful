import { expect, test } from "@playwright/test";
import type { GitLibrarySyncResult } from "../../src/shared/types";
import { baseFixture } from "./fixtures";
import { gotoApp } from "./support/app";

const teamLibrary = {
  id: "team",
  name: "Team Playbook",
  remoteUrl: "git@github.com:acme/skill-playbook.git",
  branch: "main",
  path: "",
  syncMode: "pull" as const,
  autoSync: true,
  syncIntervalMinutes: 60,
  readOnly: true,
};

function syncResult(overrides: Partial<GitLibrarySyncResult>): GitLibrarySyncResult {
  return {
    libraryId: "team",
    state: "up-to-date",
    path: "/mock/skillful/libraries/team",
    remoteUrl: teamLibrary.remoteUrl,
    branch: "main",
    cloned: false,
    pulled: false,
    pushed: false,
    localChanges: [],
    ...overrides,
  };
}

test("announces a git library that finished cloning in the background", async ({ page }) => {
  await gotoApp(page, {
    ...baseFixture,
    settings: { ...baseFixture.settings, gitLibraries: [teamLibrary] },
  });

  await page.evaluate(
    (result) => window.__SKILLFUL_E2E_EVENTS__?.emitGitLibrarySynced(result),
    syncResult({ cloned: true })
  );

  const toast = page.locator(".app-notification").filter({ hasText: "Git library synced" });
  await expect(toast).toContainText("Team Playbook was cloned and added to your library.");
});

test("reports a background sync failure", async ({ page }) => {
  await gotoApp(page, {
    ...baseFixture,
    settings: { ...baseFixture.settings, gitLibraries: [teamLibrary] },
  });

  await page.evaluate(
    (result) => window.__SKILLFUL_E2E_EVENTS__?.emitGitLibrarySynced(result),
    syncResult({ state: "auth-failed", message: "Permission denied (publickey)." })
  );

  const toast = page.locator(".app-notification").filter({ hasText: "Git library sync failed" });
  await expect(toast).toContainText("Permission denied (publickey).");
});
