import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pathExists } from "./fs";
import { defaultAppConfig, defaultGitBackupConfig, loadSavedSettings } from "./settings";
import { LibraryItemStore } from "./skills";

let configRoot: string;
let libraryRoot: string;
let originalXdg: string | undefined;
let originalHome: string | undefined;
let originalAppData: string | undefined;

beforeEach(async () => {
  configRoot = await mkdtemp(path.join(tmpdir(), "skillful-save-warning-config-"));
  libraryRoot = await mkdtemp(path.join(tmpdir(), "skillful-save-warning-library-"));
  originalXdg = process.env.XDG_CONFIG_HOME;
  originalHome = process.env.HOME;
  originalAppData = process.env.APPDATA;
  process.env.XDG_CONFIG_HOME = configRoot;
  process.env.HOME = configRoot;
  process.env.APPDATA = configRoot;

  const itemRoot = path.join(libraryRoot, "skills", "test-collection", "review-pr");
  await mkdir(itemRoot, { recursive: true });
  await writeFile(
    path.join(itemRoot, "SKILL.md"),
    ["---", "name: Review PR", "---", "", "# Review PR", "", "Initial body."].join("\n"),
    "utf8"
  );
  await writeFile(path.join(itemRoot, "notes.md"), "# Notes\n\nInitial note.\n", "utf8");
});

afterEach(async () => {
  if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = originalXdg;
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalAppData === undefined) delete process.env.APPDATA;
  else process.env.APPDATA = originalAppData;
  await rm(configRoot, { recursive: true, force: true });
  await rm(libraryRoot, { recursive: true, force: true });
});

describe("LibraryItemStore save warnings", () => {
  it("returns a warning when the saved entry frontmatter is missing description", async () => {
    const store = new LibraryItemStore([libraryRoot]);
    await store.scanAll();
    const item = store.listLibraryItems()[0];

    const saved = await store.saveLibraryItemFiles(item.id, [
      {
        relativePath: "SKILL.md",
        content: ["---", "name: Review PR", "---", "", "# Review PR", "", "Updated body."].join(
          "\n"
        ),
      },
    ]);

    expect(saved.warnings).toEqual(["SKILL.md: Missing frontmatter description."]);
  });

  it("does not warn for a supporting markdown file without frontmatter", async () => {
    const store = new LibraryItemStore([libraryRoot]);
    await store.scanAll();
    const item = store.listLibraryItems()[0];

    const saved = await store.saveLibraryItemFiles(item.id, [
      {
        relativePath: "notes.md",
        content: "# Notes\n\nUpdated note.\n",
      },
    ]);

    expect(saved.warnings).toBeUndefined();
  });

  it("warns for a supporting markdown file with incomplete frontmatter", async () => {
    const store = new LibraryItemStore([libraryRoot]);
    await store.scanAll();
    const item = store.listLibraryItems()[0];

    const saved = await store.saveLibraryItemFiles(item.id, [
      {
        relativePath: "notes.md",
        content: ["---", "name: Notes", "---", "", "# Notes", "", "Updated note."].join("\n"),
      },
    ]);

    expect(saved.warnings).toEqual(["notes.md: Missing frontmatter description."]);
  });
});

describe("LibraryItemStore git libraries", () => {
  async function storeWithGitLibrary(readOnly: boolean) {
    const store = new LibraryItemStore([libraryRoot]);
    await store.saveConfig({
      ...defaultAppConfig([]),
      scanRoots: [],
      gitLibraries: [
        {
          id: "lib-1",
          name: "Team skills",
          remoteUrl: "git@example.com:me/skills.git",
          branch: "main",
          path: libraryRoot,
          syncMode: "pull",
          autoSync: false,
          syncIntervalMinutes: 60,
          readOnly,
        },
      ],
    });
    await store.scanAll();
    return store;
  }

  it("stamps items discovered inside a git library clone", async () => {
    const store = await storeWithGitLibrary(false);

    expect(store.listLibraryItems()[0]?.sourceLibraryId).toBe("lib-1");
  });

  it("leaves items outside any git library unstamped", async () => {
    const store = new LibraryItemStore([libraryRoot]);
    await store.scanAll();

    expect(store.listLibraryItems()[0]?.sourceLibraryId).toBeUndefined();
  });

  it("refuses to save into a read-only git library", async () => {
    const store = await storeWithGitLibrary(true);
    const item = store.listLibraryItems()[0];

    await expect(
      store.saveLibraryItemFiles(item.id, [{ relativePath: "notes.md", content: "nope" }])
    ).rejects.toMatchObject({ code: "git-library-read-only" });
  });

  it("refuses to rename or delete inside a read-only git library", async () => {
    const store = await storeWithGitLibrary(true);
    const item = store.listLibraryItems()[0];

    await expect(store.renameLibraryItem(item.id, "Renamed")).rejects.toMatchObject({
      code: "git-library-read-only",
    });
    await expect(store.deleteLibraryItem(item.id)).rejects.toMatchObject({
      code: "git-library-read-only",
    });
  });

  it("allows writes when the git library is not read-only", async () => {
    const store = await storeWithGitLibrary(false);
    const item = store.listLibraryItems()[0];

    const saved = await store.saveLibraryItemFiles(item.id, [
      { relativePath: "notes.md", content: "# Notes\n\nEdited.\n" },
    ]);

    expect(saved.item.sourceLibraryId).toBe("lib-1");
  });

  it("still allows reading a read-only item", async () => {
    const store = await storeWithGitLibrary(true);
    const item = store.listLibraryItems()[0];

    await expect(store.readLibraryItem(item.id)).resolves.toMatchObject({
      item: { id: item.id },
    });
  });

  it("refuses to create an item inside a read-only git library", async () => {
    const store = await storeWithGitLibrary(true);

    await expect(
      store.createLibraryItem({
        kind: "skill",
        collectionId: "test-collection",
        name: "New Skill",
        description: "Should never be written.",
      })
    ).rejects.toMatchObject({ code: "git-library-read-only" });

    await expect(
      pathExists(path.join(libraryRoot, "skills", "test-collection", "new-skill"))
    ).resolves.toBe(false);
  });

  it("allows creating an item when the git library is writable", async () => {
    const store = await storeWithGitLibrary(false);

    const created = await store.createLibraryItem({
      kind: "skill",
      collectionId: "test-collection",
      name: "New Skill",
      description: "Allowed.",
    });

    expect(created.sourceLibraryId).toBe("lib-1");
  });

  it("refuses to rename a collection that lives in a read-only git library", async () => {
    const store = await storeWithGitLibrary(true);

    await expect(store.renameCollection("test-collection", "Renamed")).rejects.toMatchObject({
      code: "git-library-read-only",
    });
  });

  it("marks collections inside a read-only git library so the UI can gate creation", async () => {
    const store = await storeWithGitLibrary(true);

    const collections = await store.listCollections();
    expect(collections[0]?.sourceLibraryId).toBe("lib-1");
  });
});

describe("LibraryItemStore settings", () => {
  it("persists onboarding completion without rebuilding the full config", async () => {
    const store = new LibraryItemStore([libraryRoot]);

    await store.setOnboardingTourCompleted(true);

    await expect(loadSavedSettings()).resolves.toMatchObject({
      onboardingTourCompleted: true,
    });
    await expect(store.getConfig()).resolves.toMatchObject({
      onboardingTourCompleted: true,
    });
  });

  it("throws when git restore fails instead of applying default settings", async () => {
    const store = new LibraryItemStore([libraryRoot]);

    await expect(
      store.restoreGitBackup(
        {
          ...defaultGitBackupConfig(),
          enabled: true,
          remoteUrl: path.join(configRoot, "missing-remote.git"),
          branch: "main",
        },
        "safe"
      )
    ).rejects.toMatchObject({ code: "internal" });
  });
});

describe("LibraryItemStore collections", () => {
  it("moves an existing item into a newly-created empty collection", async () => {
    const store = new LibraryItemStore([libraryRoot]);
    await store.scanAll();
    const item = store.listLibraryItems()[0];

    const collection = await store.createCollection("Launch");

    await expect(store.listCollections()).resolves.toContainEqual(collection);
    const moved = await store.moveLibraryItem({
      id: item.id,
      collectionId: collection.id,
    });

    expect(moved.item.collectionId).toBe(collection.id);
    expect(moved.item.rootPath).toContain(path.join("skills", collection.id, "review-pr"));
  });
});
