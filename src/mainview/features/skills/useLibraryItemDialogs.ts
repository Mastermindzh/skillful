import { useCallback, useState } from "react";
import { libraryItemLabel } from "../../../shared/library";
import type { LibraryItemKind, LibraryItemSummary } from "../../../shared/types";
import { useAppTranslation } from "../../i18n/i18n";
import { notify } from "../notifications/notify";
import type { LibraryKindFilter } from "./libraryItems";
import type { useLibraryItemLibrary } from "./useLibraryItemLibrary";

type Library = ReturnType<typeof useLibraryItemLibrary>;

type LibraryItemToDelete = {
  id: string;
  title: string;
  path: string;
  kind: LibraryItemKind;
};

type LibraryItemToRename = {
  id: string;
  title: string;
  kind: LibraryItemKind;
};

type LibraryItemToMove = {
  id: string;
  title: string;
  kind: LibraryItemKind;
  collectionId: string;
};

type CollectionOption = { id: string };

export type UseLibraryItemDialogsArgs = {
  library: Library;
  collections: CollectionOption[];
  activeCollectionId: string | null;
  setActiveScope: (scope: string) => void;
  setQuery: (query: string) => void;
  setKindFilter: (filter: LibraryKindFilter) => void;
};

/**
 * Encapsulates every item-level modal (create, rename, delete) and the saving/error flags that
 * feed each modal. Extracted from `App.tsx` so the outer component is closer to pure composition.
 */
export function useLibraryItemDialogs({
  library,
  collections,
  activeCollectionId,
  setActiveScope,
  setQuery,
  setKindFilter,
}: UseLibraryItemDialogsArgs) {
  const { t } = useAppTranslation();
  const [libraryItemModalOpen, setSkillModalOpen] = useState(false);
  const [libraryItemSaving, setSkillSaving] = useState(false);
  const [libraryItemError, setSkillError] = useState<string | null>(null);

  const [libraryItemToDelete, setSkillToDelete] = useState<LibraryItemToDelete | null>(null);
  const [libraryItemDeleting, setSkillDeleting] = useState(false);
  const [deleteLibraryItemError, setDeleteSkillError] = useState<string | null>(null);

  const [libraryItemToRename, setSkillToRename] = useState<LibraryItemToRename | null>(null);
  const [renameLibraryItemError, setRenameSkillError] = useState<string | null>(null);

  const [libraryItemToMove, setSkillToMove] = useState<LibraryItemToMove | null>(null);
  const [libraryItemMoving, setSkillMoving] = useState(false);
  const [moveLibraryItemError, setMoveSkillError] = useState<string | null>(null);

  const openCreateModal = useCallback(() => {
    setSkillError(null);
    setSkillModalOpen(true);
  }, []);

  const closeCreateModal = useCallback(() => setSkillModalOpen(false), []);

  const requestRename = useCallback((item: LibraryItemSummary) => {
    setRenameSkillError(null);
    setSkillToRename({ id: item.id, title: item.title, kind: item.kind });
  }, []);

  const closeRenameModal = useCallback(() => {
    setRenameSkillError(null);
    setSkillToRename(null);
  }, []);

  const requestDelete = useCallback((item: LibraryItemSummary) => {
    setDeleteSkillError(null);
    setSkillToDelete({ id: item.id, title: item.title, path: item.rootPath, kind: item.kind });
  }, []);

  const requestMove = useCallback((item: LibraryItemSummary) => {
    setMoveSkillError(null);
    setSkillToMove({
      id: item.id,
      title: item.title,
      kind: item.kind,
      collectionId: item.collectionId,
    });
  }, []);

  const closeMoveModal = useCallback(() => {
    setMoveSkillError(null);
    setSkillToMove(null);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteSkillError(null);
    setSkillToDelete(null);
  }, []);

  const handleCreate = useCallback(
    async (input: {
      kind: LibraryItemKind;
      collectionId: string;
      name: string;
      description: string;
    }) => {
      setSkillSaving(true);
      setSkillError(null);
      try {
        const createdLibraryItem = await library.createLibraryItem(input);
        if (!createdLibraryItem) {
          setSkillError(t("item.error.create", { kind: input.kind }));
          return false;
        }

        const targetCollection = collections.find(
          (collection) => collection.id === input.collectionId
        );
        setQuery("");
        if (targetCollection) {
          setActiveScope(`collection:${targetCollection.id}`);
        }
        setKindFilter(input.kind);
        setSkillModalOpen(false);
        const kindLabel = libraryItemLabel(input.kind);
        notify.success(t("item.notification.created.message", { name: createdLibraryItem.title }), {
          title: t("item.notification.created.title", { kind: kindLabel }),
        });
        return true;
      } finally {
        setSkillSaving(false);
      }
    },
    [collections, library, setActiveScope, setKindFilter, setQuery, t]
  );

  const handleRename = useCallback(
    async (name: string) => {
      if (!libraryItemToRename) return null;
      try {
        const renamed = await library.renameLibraryItem(name, libraryItemToRename.id);
        if (renamed) {
          setRenameSkillError(null);
          setSkillToRename(null);
          notify.success(t("item.notification.renamed.message", { name: renamed.item.title }), {
            title: t("item.notification.renamed.title", {
              kind: libraryItemLabel(libraryItemToRename.kind),
            }),
          });
          return renamed;
        }
        return null;
      } catch (error) {
        setRenameSkillError(error instanceof Error ? error.message : t("item.error.rename"));
        return null;
      }
    },
    [library, libraryItemToRename, t]
  );

  const handleDelete = useCallback(async () => {
    if (!libraryItemToDelete) return;
    setSkillDeleting(true);
    setDeleteSkillError(null);
    try {
      const deleted = await library.deleteLibraryItem(libraryItemToDelete.id);
      if (!deleted) {
        setDeleteSkillError(t("item.error.delete", { kind: libraryItemToDelete.kind }));
        return;
      }
      notify.info(t("item.notification.deleted.message", { name: libraryItemToDelete.title }), {
        title: t("item.notification.deleted.title", {
          kind: libraryItemLabel(libraryItemToDelete.kind),
        }),
      });
      setSkillToDelete(null);
    } finally {
      setSkillDeleting(false);
    }
  }, [library, libraryItemToDelete, t]);

  const handleMove = useCallback(
    async (collectionId: string) => {
      if (!libraryItemToMove) return false;
      setSkillMoving(true);
      setMoveSkillError(null);
      try {
        const moved = await library.moveLibraryItem(collectionId, libraryItemToMove.id);
        if (!moved) {
          setMoveSkillError(t("item.error.move", { kind: libraryItemToMove.kind }));
          return false;
        }
        setQuery("");
        setActiveScope(`collection:${moved.item.collectionId}`);
        setKindFilter(moved.item.kind);
        setMoveSkillError(null);
        setSkillToMove(null);
        notify.success(t("item.notification.moved.message", { name: moved.item.title }), {
          title: t("item.notification.moved.title", {
            kind: libraryItemLabel(libraryItemToMove.kind),
          }),
        });
        return true;
      } catch (error) {
        setMoveSkillError(error instanceof Error ? error.message : t("item.error.moveGeneric"));
        return false;
      } finally {
        setSkillMoving(false);
      }
    },
    [library, libraryItemToMove, setActiveScope, setKindFilter, setQuery, t]
  );

  const defaultCollectionId = activeCollectionId ?? collections[0]?.id ?? null;

  return {
    create: {
      opened: libraryItemModalOpen,
      saving: libraryItemSaving,
      errorMessage: libraryItemError,
      defaultCollectionId,
      open: openCreateModal,
      close: closeCreateModal,
      onCreate: handleCreate,
    },
    rename: {
      target: libraryItemToRename,
      errorMessage: renameLibraryItemError,
      request: requestRename,
      close: closeRenameModal,
      onRename: handleRename,
    },
    move: {
      target: libraryItemToMove,
      moving: libraryItemMoving,
      errorMessage: moveLibraryItemError,
      request: requestMove,
      close: closeMoveModal,
      onMove: handleMove,
    },
    delete: {
      target: libraryItemToDelete,
      deleting: libraryItemDeleting,
      errorMessage: deleteLibraryItemError,
      request: requestDelete,
      close: closeDeleteDialog,
      onDelete: handleDelete,
    },
  };
}

export type LibraryItemDialogs = ReturnType<typeof useLibraryItemDialogs>;
