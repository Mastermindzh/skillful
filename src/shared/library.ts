import type { LibraryItemCollectionSummary, LibraryItemKind } from "./types";

export const LIBRARY_ITEM_KINDS = ["skill", "agent"] as const satisfies readonly LibraryItemKind[];

export const LIBRARY_FOLDER_BY_KIND = {
  skill: "skills",
  agent: "agents",
} as const satisfies Record<LibraryItemKind, string>;

export const ENTRY_FILE_BY_KIND = {
  skill: "SKILL.md",
  agent: "AGENT.md",
} as const satisfies Record<LibraryItemKind, string>;

export function libraryItemLabel(kind: LibraryItemKind) {
  return kind === "agent" ? "Agent" : "Skill";
}

export function slugFromText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export function installFolderNameFromTitle(title: string, fallbackName: string) {
  return slugFromText(title) || fallbackName;
}

export function titleFromPathSegment(segment: string) {
  return segment
    .replace(/[-_.]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function collectionSummaryFromFolderName(folderName: string) {
  return {
    id: folderName,
    title: titleFromPathSegment(folderName),
  } satisfies LibraryItemCollectionSummary;
}
