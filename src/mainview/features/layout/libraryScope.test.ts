import { describe, expect, it } from "vitest";
import type { GitLibraryConfig, LibraryItemSummary } from "../../../shared/types";
import type { LibraryCollection, LibraryToolFilter } from "../skills/libraryItems";
import { readOnlyCollectionIds, resolveScope } from "./libraryScope";

function item(id: string): LibraryItemSummary {
  return {
    id,
    kind: "skill",
    collectionId: "c",
    title: id,
    description: "",
    rootPath: `/lib/${id}`,
    entryPath: `/lib/${id}/SKILL.md`,
    supportingFiles: [],
  };
}

const [a, b, c] = [item("a"), item("b"), item("c")];
const collections: LibraryCollection[] = [
  { id: "work", title: "Work", items: [a, b] },
  { id: "shared", title: "Shared", sourceLibraryId: "team", items: [c] },
];
const tools: LibraryToolFilter[] = [{ id: "codex", title: "Codex", items: [b] }];

describe("resolveScope", () => {
  it("shows every item for the all scope", () => {
    expect(resolveScope("all", collections, tools, [a, b, c])).toEqual({
      activeCollection: null,
      activeTool: null,
      scopedItems: [a, b, c],
    });
  });

  it("narrows to a collection or tool", () => {
    expect(resolveScope("collection:work", collections, tools, [a, b, c])).toMatchObject({
      activeCollection: collections[0],
      scopedItems: [a, b],
    });
    expect(resolveScope("tool:codex", collections, tools, [a, b, c])).toMatchObject({
      activeTool: tools[0],
      scopedItems: [b],
    });
  });

  it("shows nothing for a scope that no longer exists", () => {
    expect(resolveScope("collection:gone", collections, tools, [a, b, c])).toEqual({
      activeCollection: null,
      activeTool: null,
      scopedItems: [],
    });
  });
});

describe("readOnlyCollectionIds", () => {
  it("only marks collections from a read-only git library", () => {
    const library = (readOnly: boolean) => ({ id: "team", readOnly }) as GitLibraryConfig;
    expect(readOnlyCollectionIds(collections, new Map([["team", library(true)]]))).toEqual(
      new Set(["shared"])
    );
    expect(readOnlyCollectionIds(collections, new Map([["team", library(false)]])).size).toBe(0);
  });
});
