import { describe, expect, it } from "vitest";
import type { LibraryItemDocument } from "../../../shared/types";
import { buildDraftMap, pruneDraftsForKnownLibraryItems } from "./drafts";

function makeDocument(itemId: string, files: Array<{ path: string; content: string }>) {
  return {
    item: { id: itemId } as LibraryItemDocument["item"],
    files: files.map((file) => ({
      relativePath: file.path,
      absolutePath: `/fake/${itemId}/${file.path}`,
      content: file.content,
      isEntry: file.path === "SKILL.md",
    })),
    additionalFiles: [],
  } satisfies LibraryItemDocument;
}

describe("buildDraftMap", () => {
  it("returns the same reference when every file already has a draft entry", () => {
    const doc = makeDocument("s1", [{ path: "SKILL.md", content: "fresh" }]);
    const drafts = { "s1::SKILL.md": "already edited" };
    const result = buildDraftMap(doc, drafts);
    expect(result).toBe(drafts);
  });

  it("seeds missing entries while preserving existing drafts by identity of unrelated keys", () => {
    const doc = makeDocument("s1", [
      { path: "SKILL.md", content: "fresh" },
      { path: "notes.md", content: "new notes" },
    ]);
    const drafts = { "s1::SKILL.md": "already edited" };
    const result = buildDraftMap(doc, drafts);
    expect(result).not.toBe(drafts);
    expect(result["s1::SKILL.md"]).toBe("already edited");
    expect(result["s1::notes.md"]).toBe("new notes");
  });
});

describe("pruneDraftsForKnownLibraryItems", () => {
  it("returns the same instance when no drafts need pruning", () => {
    const drafts = { "s1::file.md": "x", "s2::other.md": "y" };
    const result = pruneDraftsForKnownLibraryItems(drafts, ["s1", "s2"]);
    expect(result).toBe(drafts);
  });

  it("drops drafts whose skill id is no longer known", () => {
    const drafts = { "s1::file.md": "x", "gone::other.md": "y" };
    const result = pruneDraftsForKnownLibraryItems(drafts, ["s1"]);
    expect(result).toEqual({ "s1::file.md": "x" });
  });

  it("treats no-separator keys as the skill id itself", () => {
    const drafts = { "legacy-key": "x", "s1::file.md": "y" };
    const result = pruneDraftsForKnownLibraryItems(drafts, ["s1", "legacy-key"]);
    expect(result).toEqual(drafts);
  });

  it("drops everything when known ids is empty", () => {
    const drafts = { "s1::file.md": "x" };
    const result = pruneDraftsForKnownLibraryItems(drafts, []);
    expect(result).toEqual({});
  });

  it("accepts an iterable of known ids", () => {
    const drafts = { "s1::file.md": "x", "s2::other.md": "y" };
    const known = new Set(["s1"]);
    const result = pruneDraftsForKnownLibraryItems(drafts, known);
    expect(result).toEqual({ "s1::file.md": "x" });
  });
});
