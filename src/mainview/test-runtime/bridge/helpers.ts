import { ENTRY_FILE_BY_KIND, libraryItemLabel } from "../../../shared/library";
import { joinPortablePath, portablePathSegments } from "../../../shared/paths";
import type {
  LibraryItemDocument,
  LibraryItemFile,
  LibraryItemSummary,
} from "../../../shared/types";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
let sequence = 0;

export function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function compareLabels(left: string, right: string) {
  return collator.compare(left, right);
}

export function sortSkills(items: LibraryItemSummary[]) {
  return [...items].sort(
    (a, b) => compareLabels(a.title, b.title) || compareLabels(a.entryPath, b.entryPath)
  );
}

export function entryFileName(kind: LibraryItemSummary["kind"]) {
  return ENTRY_FILE_BY_KIND[kind];
}

export function defaultEntryContent(input: {
  kind: LibraryItemSummary["kind"];
  title: string;
  description?: string;
}) {
  const heading = libraryItemLabel(input.kind);
  const description = input.description ?? `${heading} created in the E2E harness.`;
  return `---
name: ${JSON.stringify(input.title)}
description: ${JSON.stringify(description)}
---

# ${input.title}

${description}
`;
}

export function buildSummary(document: LibraryItemDocument): LibraryItemSummary {
  return {
    ...document.item,
    supportingFiles: document.files
      .filter((file) => !file.isEntry)
      .map((file) => file.relativePath),
  };
}

export function withAbsolutePath(rootPath: string, relativePath: string) {
  return joinPortablePath(rootPath, relativePath);
}

export function normalizeEditableFile(rootPath: string, file: LibraryItemFile): LibraryItemFile {
  return {
    ...file,
    absolutePath: file.absolutePath || withAbsolutePath(rootPath, file.relativePath),
  };
}

export function fileLabelToRelativePath(name: string) {
  const trimmed = name.trim().replace(/^\/+|\/+$/g, "");
  return trimmed.toLowerCase().endsWith(".md") ? trimmed : `${trimmed}.md`;
}

export function renameRelativePath(relativePath: string, name: string) {
  const normalized = fileLabelToRelativePath(name);
  const segments = portablePathSegments(relativePath);
  segments[segments.length - 1] = normalized;
  return segments.join("/");
}

export function updateSummary(document: LibraryItemDocument) {
  document.item.supportingFiles = document.files
    .filter((file) => !file.isEntry)
    .map((file) => file.relativePath);
  document.item.entryPath =
    document.files.find((file) => file.isEntry)?.absolutePath ?? document.item.entryPath;
}
