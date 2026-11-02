import { useDeferredValue, useEffect, useMemo } from "react";
import { toolPresetById } from "../../../shared/toolPresets";
import type {
  AppSettings,
  LibraryItemCollectionSummary,
  LibraryItemSummary,
} from "../../../shared/types";
import { measureRenderer } from "../../performance";
import {
  buildLibraryCollections,
  buildLibraryItemSearchIndex,
  buildToolFilters,
  filterByKind,
  filterLibraryItemSearchIndex,
} from "../skills/libraryItems";
import { isToolScope, readOnlyCollectionIds, resolveScope } from "./libraryScope";
import { useScopeState } from "./useScopeState";

type UseLibraryViewOptions = {
  libraryItems: LibraryItemSummary[];
  collectionList: LibraryItemCollectionSummary[];
  appSettings: AppSettings | null;
  activeItemId: string | null;
  clearActiveItem: () => void;
  setActiveItemId: (id: string | null) => void;
};

/**
 * Everything the sidebar and list pane show: collections and tools, the active scope and filters,
 * and the resulting item list. Also keeps the selection on an item that is still visible.
 */
export function useLibraryView({
  libraryItems,
  collectionList,
  appSettings,
  activeItemId,
  clearActiveItem,
  setActiveItemId,
}: UseLibraryViewOptions) {
  const collections = useMemo(
    () =>
      measureRenderer(
        "renderer.buildLibraryCollections",
        () => buildLibraryCollections(libraryItems, collectionList),
        (result) => ({ items: libraryItems.length, collections: result.length })
      ),
    [collectionList, libraryItems]
  );
  const tools = useMemo(
    () =>
      measureRenderer(
        "renderer.buildToolFilters",
        () =>
          buildToolFilters(libraryItems, appSettings?.tools ?? [], appSettings?.toolMappings ?? []),
        (result) => ({ items: libraryItems.length, tools: result.length })
      ),
    [appSettings?.toolMappings, appSettings?.tools, libraryItems]
  );

  const scope = useScopeState(collections, tools);
  const { activeScope, kindFilter } = scope;
  const deferredQuery = useDeferredValue(scope.query);

  const { activeCollection, activeTool, scopedItems } = useMemo(
    () => resolveScope(activeScope, collections, tools, libraryItems),
    [activeScope, collections, libraryItems, tools]
  );
  const collectionTitleById = useMemo(
    () => new Map(collections.map((collection) => [collection.id, collection.title])),
    [collections]
  );
  const gitLibraryById = useMemo(
    () => new Map((appSettings?.gitLibraries ?? []).map((library) => [library.id, library])),
    [appSettings?.gitLibraries]
  );
  const readOnlyIds = useMemo(
    () => readOnlyCollectionIds(collections, gitLibraryById),
    [collections, gitLibraryById]
  );
  const writableCollections = useMemo(
    () => collections.filter((collection) => !readOnlyIds.has(collection.id)),
    [collections, readOnlyIds]
  );

  const kindScopedItems = useMemo(
    () =>
      measureRenderer(
        "renderer.filterByKind",
        () => filterByKind(scopedItems, kindFilter),
        (result) => ({ input: scopedItems.length, output: result.length, kindFilter })
      ),
    [kindFilter, scopedItems]
  );
  const searchableItems = useMemo(
    () =>
      measureRenderer(
        "renderer.buildLibraryItemSearchIndex",
        () => buildLibraryItemSearchIndex(kindScopedItems),
        (result) => ({ items: result.length })
      ),
    [kindScopedItems]
  );
  const shownItems = useMemo(
    () =>
      measureRenderer(
        "renderer.filterLibraryItemSearchIndex",
        () => filterLibraryItemSearchIndex(searchableItems, deferredQuery),
        (result) => ({
          input: searchableItems.length,
          output: result.length,
          queryLength: deferredQuery.trim().length,
        })
      ),
    [deferredQuery, searchableItems]
  );

  const sidebarCollections = useMemo(
    () =>
      collections.map((collection) => ({
        id: collection.id,
        title: collection.title,
        count: collection.items.length,
      })),
    [collections]
  );
  const sidebarTools = useMemo(
    () =>
      tools.map((tool) => ({
        id: tool.id,
        title: tool.title,
        count: tool.items.length,
        icon: toolPresetById(tool.id)?.icon ?? "tool",
      })),
    [tools]
  );

  useEffect(() => {
    if (shownItems.length === 0) {
      clearActiveItem();
      return;
    }
    if (activeItemId && shownItems.some((item) => item.id === activeItemId)) return;
    setActiveItemId(shownItems[0]?.id ?? null);
  }, [activeItemId, clearActiveItem, setActiveItemId, shownItems]);

  return {
    scope,
    collections,
    activeCollection,
    activeTool,
    activeCollectionReadOnly: Boolean(activeCollection && readOnlyIds.has(activeCollection.id)),
    writableCollections,
    collectionTitleById,
    gitLibraryById,
    /**
     * Per-row collection labels only help when the scope can span collections; inside one
     * collection the sidebar already says which one it is.
     */
    showItemCollections: activeScope === "all" || isToolScope(activeScope),
    shownItems,
    sidebarCollections,
    sidebarTools,
  };
}
