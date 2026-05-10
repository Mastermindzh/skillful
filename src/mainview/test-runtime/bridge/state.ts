import { slugFromText } from "../../../shared/library";
import type {
  CreateLibraryItemInput,
  LibraryItemCollectionSummary,
  LibraryItemDocument,
  LibraryItemToolStatus,
  ToolConfig,
  ToolInstallState,
} from "../../../shared/types";
import { emitLibraryItemsUpdated } from "./events";
import { createInitialState, normalizeCollections } from "./fixtures";
import {
  buildSummary,
  clone,
  defaultEntryContent,
  entryFileName,
  nextId,
  sortSkills,
  updateSummary,
  withAbsolutePath,
} from "./helpers";

export const state = createInitialState();
export const createdDirectories = new Set<string>();

export function listSkillsInternal() {
  return sortSkills(state.documents.map((document) => buildSummary(document)));
}

export function listCollectionsInternal() {
  state.collections = normalizeCollections(state.collections, state.documents);
  return clone(state.collections);
}

export function emitLibraryItemsUpdatedForReason(reason: string) {
  emitLibraryItemsUpdated({
    libraryItems: listSkillsInternal(),
    reason,
  });
}

export function findLibraryItem(id: string) {
  return state.documents.find((document) => document.item.id === id) ?? null;
}

export function findCollection(id: string) {
  return state.collections.find((collection) => collection.id === id) ?? null;
}

export function toolStatusFor(tool: ToolConfig, itemId: string): LibraryItemToolStatus {
  const mapped =
    state.settings.toolMappings.find((mapping) => mapping.itemId === itemId)?.toolIds ?? [];
  const stateValue: ToolInstallState = mapped.includes(tool.id) ? "installed" : "not-installed";
  const kind = findLibraryItem(itemId)?.item.kind ?? "skill";
  const installRoots = tool.installRoots[kind] ?? [];
  return {
    toolId: tool.id,
    toolName: tool.name,
    mapped: mapped.includes(tool.id),
    state: stateValue,
    installRoots: clone(installRoots),
    workingRoots: stateValue === "installed" ? clone(installRoots) : [],
    problemRoots: [],
  };
}

export function ensureCollection(id: string) {
  const existing = findCollection(id);
  if (existing) return existing;
  const collection: LibraryItemCollectionSummary = { id, title: id };
  state.collections.push(collection);
  return collection;
}

export function buildNewDocument(input: CreateLibraryItemInput): LibraryItemDocument {
  const collection = ensureCollection(input.collectionId);
  const id = nextId(input.kind);
  const rootName = slugFromText(input.name);
  const rootPath = `${state.settings.defaultScanRoot}/${collection.id}/${rootName || id}`;
  const entryRelativePath = entryFileName(input.kind);

  return {
    item: {
      id,
      kind: input.kind,
      collectionId: collection.id,
      title: input.name.trim(),
      description: input.description.trim(),
      rootPath,
      entryPath: `${rootPath}/${entryRelativePath}`,
      supportingFiles: [],
    },
    files: [
      {
        relativePath: entryRelativePath,
        absolutePath: `${rootPath}/${entryRelativePath}`,
        content: defaultEntryContent({
          kind: input.kind,
          title: input.name.trim(),
          description: input.description.trim(),
        }),
        isEntry: true,
      },
    ],
    additionalFiles: [],
  };
}

export { buildSummary, clone, updateSummary, withAbsolutePath };
