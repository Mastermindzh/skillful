import type { GitLibraryConfig, LibraryItemSummary } from "../../../shared/types";
import type { LibraryCollection, LibraryToolFilter } from "../skills/libraryItems";

const COLLECTION_PREFIX = "collection:";
const TOOL_PREFIX = "tool:";

export function isToolScope(scope: string) {
  return scope.startsWith(TOOL_PREFIX);
}

/** The collection or tool behind `activeScope`, and the items that scope contains. */
export function resolveScope(
  activeScope: string,
  collections: LibraryCollection[],
  tools: LibraryToolFilter[],
  allItems: LibraryItemSummary[]
) {
  const activeCollection = activeScope.startsWith(COLLECTION_PREFIX)
    ? (collections.find(
        (collection) => collection.id === activeScope.slice(COLLECTION_PREFIX.length)
      ) ?? null)
    : null;
  const activeTool = activeScope.startsWith(TOOL_PREFIX)
    ? (tools.find((tool) => tool.id === activeScope.slice(TOOL_PREFIX.length)) ?? null)
    : null;
  const scopedItems = activeScope.startsWith(TOOL_PREFIX)
    ? (activeTool?.items ?? [])
    : activeScope.startsWith(COLLECTION_PREFIX)
      ? (activeCollection?.items ?? [])
      : allItems;
  return { activeCollection, activeTool, scopedItems };
}

/** Collections that come from a read-only git library. */
export function readOnlyCollectionIds(
  collections: LibraryCollection[],
  gitLibraryById: ReadonlyMap<string, GitLibraryConfig>
) {
  const ids = new Set<string>();
  for (const collection of collections) {
    const libraryId = collection.sourceLibraryId;
    if (libraryId && gitLibraryById.get(libraryId)?.readOnly) ids.add(collection.id);
  }
  return ids;
}
