import { describe, expect, it } from "vitest";
import type { GitLibraryConfig } from "../../../../shared/types";
import { type GitLibraryRow, sameGitLibraries, validateGitLibraryRows } from "./gitLibraries";

function row(overrides: Partial<GitLibraryRow> = {}): GitLibraryRow {
  return {
    id: "library-1",
    name: "Team skills",
    remoteUrl: "git@example.com:me/skills.git",
    branch: "main",
    path: "",
    syncMode: "pull",
    autoSync: true,
    syncIntervalMinutes: 60,
    readOnly: false,
    ...overrides,
  };
}

describe("validateGitLibraryRows", () => {
  it("accepts a fully configured library", () => {
    const validation = validateGitLibraryRows([row()]);

    expect(validation.hasErrors).toBe(false);
    expect(validation.libraries).toHaveLength(1);
  });

  it("ignores blank rows the user has not filled in", () => {
    const validation = validateGitLibraryRows([row({ name: "", remoteUrl: "", path: "" })]);

    expect(validation.hasErrors).toBe(false);
    expect(validation.libraries).toHaveLength(0);
  });

  it("drops rows marked for removal", () => {
    const validation = validateGitLibraryRows([row({ pendingRemoval: true })]);

    expect(validation.libraries).toHaveLength(0);
  });

  it("requires a name and a remote", () => {
    const validation = validateGitLibraryRows([row({ name: "", remoteUrl: "", path: "/tmp/x" })]);

    expect(validation.issueById["library-1"]?.name).toBe("settings.gitLibrary.error.nameRequired");
    expect(validation.issueById["library-1"]?.remoteUrl).toBe(
      "settings.gitLibrary.error.remoteRequired"
    );
  });

  it("rejects git transport helper remotes", () => {
    const validation = validateGitLibraryRows([row({ remoteUrl: 'ext::sh -c "id"' })]);

    expect(validation.issueById["library-1"]?.remoteUrl).toBe(
      "settings.gitLibrary.error.remoteTransport"
    );
  });

  it("rejects branches with whitespace", () => {
    const validation = validateGitLibraryRows([row({ branch: "my branch" })]);

    expect(validation.issueById["library-1"]?.branch).toBe(
      "settings.gitLibrary.error.branchWhitespace"
    );
  });

  it("requires an absolute folder when one is given", () => {
    const validation = validateGitLibraryRows([row({ path: "relative/path" })]);

    expect(validation.issueById["library-1"]?.path).toBe("settings.gitLibrary.error.pathAbsolute");
  });

  it("rejects two libraries sharing a folder", () => {
    const validation = validateGitLibraryRows([
      row({ id: "a", path: "/tmp/shared" }),
      row({ id: "b", path: "/tmp/shared" }),
    ]);

    expect(validation.issueById.b?.path).toBe("settings.gitLibrary.error.pathDuplicate");
  });

  it("requires a sync interval of at least a minute when auto sync is on", () => {
    const validation = validateGitLibraryRows([row({ autoSync: true, syncIntervalMinutes: 0 })]);

    expect(validation.issueById["library-1"]?.syncIntervalMinutes).toBe(
      "settings.gitLibrary.error.syncInterval"
    );
  });

  it("ignores the interval when auto sync is off", () => {
    const validation = validateGitLibraryRows([row({ autoSync: false, syncIntervalMinutes: 0 })]);

    expect(validation.hasErrors).toBe(false);
  });
});

describe("sameGitLibraries", () => {
  const saved: GitLibraryConfig[] = [row()];

  it("matches identical lists", () => {
    expect(sameGitLibraries([row()], saved)).toBe(true);
  });

  it("detects a changed field", () => {
    expect(sameGitLibraries([row({ branch: "develop" })], saved)).toBe(false);
  });

  it("detects a different length", () => {
    expect(sameGitLibraries([], saved)).toBe(false);
  });
});
