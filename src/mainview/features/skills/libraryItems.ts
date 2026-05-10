import { titleFromPathSegment } from "../../../shared/library";
import { portablePathBasename, toPortablePath } from "../../../shared/paths";
import type {
  LibraryItemAdditionalFile,
  LibraryItemCollectionSummary,
  LibraryItemFile,
  LibraryItemKind,
  LibraryItemSummary,
  LibraryItemToolMapping,
  ToolConfig,
} from "../../../shared/types";

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export type LibraryKindFilter = "all" | LibraryItemKind;

export type LibraryCollection = {
  id: string;
  title: string;
  items: LibraryItemSummary[];
};

export type LibraryToolFilter = {
  id: string;
  title: string;
  items: LibraryItemSummary[];
};

type LibraryItemSearchEntry = {
  item: LibraryItemSummary;
  searchText: string;
};

function sortLibraryItems(items: LibraryItemSummary[]) {
  return [...items].sort(
    (a, b) =>
      naturalCollator.compare(a.title, b.title) || naturalCollator.compare(a.entryPath, b.entryPath)
  );
}

/** Groups library items by logical collection id, preserving empty known collections. */
export function buildLibraryCollections(
  items: LibraryItemSummary[],
  knownCollections: LibraryItemCollectionSummary[] = []
) {
  const collections = new Map<string, LibraryCollection>();

  for (const collection of knownCollections) {
    collections.set(collection.id, {
      id: collection.id,
      title: collection.title,
      items: [],
    });
  }

  for (const item of items) {
    const collection = collections.get(item.collectionId) ?? {
      id: item.collectionId,
      title: titleFromPathSegment(item.collectionId),
      items: [],
    };
    collection.items.push(item);
    collections.set(item.collectionId, collection);
  }

  return [...collections.values()]
    .map((collection) => ({
      ...collection,
      items: sortLibraryItems(collection.items),
    }))
    .sort(
      (a, b) => naturalCollator.compare(a.title, b.title) || naturalCollator.compare(a.id, b.id)
    );
}

/** Builds tool filter entries from configured tools and saved item-to-tool mappings. */
export function buildToolFilters(
  items: LibraryItemSummary[],
  tools: ToolConfig[],
  toolMappings: LibraryItemToolMapping[]
) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const mappingsByToolId = new Map<string, LibraryItemSummary[]>();

  for (const mapping of toolMappings) {
    const item = itemsById.get(mapping.itemId);
    if (!item) continue;

    for (const toolId of mapping.toolIds) {
      const mappedItems = mappingsByToolId.get(toolId) ?? [];
      mappedItems.push(item);
      mappingsByToolId.set(toolId, mappedItems);
    }
  }

  return tools
    .map((tool) => ({
      id: tool.id,
      title: tool.name,
      items: sortLibraryItems(mappingsByToolId.get(tool.id) ?? []),
    }))
    .sort((a, b) => naturalCollator.compare(a.title, b.title));
}

export function filterByKind(items: LibraryItemSummary[], kindFilter: LibraryKindFilter) {
  if (kindFilter === "all") return items;
  return items.filter((item) => item.kind === kindFilter);
}

/** Returns mapped tool ids for the editor's controlled tool picker. */
export function toolIdsForSkill(itemId: string, toolMappings: LibraryItemToolMapping[]) {
  return toolMappings.find((mapping) => mapping.itemId === itemId)?.toolIds ?? [];
}

export function buildLibraryItemSearchIndex(items: LibraryItemSummary[]): LibraryItemSearchEntry[] {
  return items.map((item) => ({
    item,
    searchText: [item.title, item.description ?? "", item.entryPath].join("\n").toLowerCase(),
  }));
}

export function filterLibraryItemSearchIndex(entries: LibraryItemSearchEntry[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return entries.map((entry) => entry.item);
  return entries
    .filter((entry) => entry.searchText.includes(normalizedQuery))
    .map((entry) => entry.item);
}

/** Filters library items by title, description, or entry path with stable ordering. */
export function filterLibraryItems(items: LibraryItemSummary[], query: string) {
  return filterLibraryItemSearchIndex(buildLibraryItemSearchIndex(items), query);
}

/** Formats file tab labels while keeping the entry file distinguishable. */
function fileNameLabel(relativePath: string) {
  return portablePathBasename(relativePath) || relativePath;
}

export function visibleFileLabel(file: LibraryItemFile) {
  if (file.isEntry) return toPortablePath(file.relativePath);
  return fileNameLabel(file.relativePath);
}

export function visibleAdditionalFileLabel(file: LibraryItemAdditionalFile) {
  return fileNameLabel(file.relativePath);
}
