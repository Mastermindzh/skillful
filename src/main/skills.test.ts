import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
