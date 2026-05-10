import { appRpc } from "@mainview-bridge";
import { useCallback, useState } from "react";
import type { LibraryItemCollectionSummary, LibraryItemSummary } from "../../../shared/types";

export type LibraryItemListSource = "list" | "refresh";

export function useLibraryIndexes() {
  const [libraryItemList, setSkillList] = useState<LibraryItemSummary[]>([]);
  const [collectionList, setCollectionList] = useState<LibraryItemCollectionSummary[]>([]);

  const loadLibraryIndexes = useCallback(async (source: LibraryItemListSource = "refresh") => {
    const [nextSkills, nextCollections] = await Promise.all([
      source === "refresh"
        ? appRpc.request.refreshLibraryItems()
        : appRpc.request.listLibraryItems(),
      appRpc.request.listCollections(),
    ]);
    setSkillList(nextSkills);
    setCollectionList(nextCollections);
    return { nextSkills, nextCollections };
  }, []);

  return {
    collectionList,
    loadLibraryIndexes,
    setCollectionList,
    setSkillList,
    libraryItemList,
  };
}
