import { useCallback, useEffect, useMemo, useState } from "react";
import type { LibraryItemSummary } from "../../../shared/types";
import type { LibraryKindFilter } from "../skills/libraryItems";

type CollectionOption = { id: string };
type ToolOption = { id: string };

/**
 * Owns the three "what's in the list pane" filters, free-text query, active scope
 * (`all` / `collection:<id>` / `tool:<id>`), and kind filter, plus the invariants that keep
 * them coherent: falling back to `all` when the selected scope vanishes, and tracking a
 * focus-search token that the list pane turns into an imperative focus.
 */
export function useScopeState(collections: CollectionOption[], tools: ToolOption[]) {
  const [query, setQuery] = useState("");
  const [activeScope, setActiveScope] = useState("all");
  const [kindFilter, setKindFilter] = useState<LibraryKindFilter>("all");
  const [focusSearchToken, setFocusSearchToken] = useState(0);

  useEffect(() => {
    if (activeScope === "all") return;
    if (
      (activeScope.startsWith("collection:") &&
        collections.some((collection) => `collection:${collection.id}` === activeScope)) ||
      (activeScope.startsWith("tool:") && tools.some((tool) => `tool:${tool.id}` === activeScope))
    ) {
      return;
    }
    setActiveScope("all");
  }, [activeScope, collections, tools]);

  const handleFocusSearch = useCallback(() => {
    setFocusSearchToken((token) => token + 1);
  }, []);

  return useMemo(
    () => ({
      query,
      setQuery,
      activeScope,
      setActiveScope,
      kindFilter,
      setKindFilter,
      focusSearchToken,
      handleFocusSearch,
    }),
    [activeScope, focusSearchToken, handleFocusSearch, kindFilter, query]
  );
}

export type ScopeState = ReturnType<typeof useScopeState>;
export type { LibraryItemSummary };
