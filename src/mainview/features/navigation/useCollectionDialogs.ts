import { appRpc } from "@mainview-bridge";
import { useCallback, useState } from "react";
import type { GitHubImportDraft } from "../../../shared/githubImport";
import type { LibraryItemCollectionSummary } from "../../../shared/types";
import { useAppTranslation } from "../../i18n/i18n";
import { notify } from "../notifications/notify";
import type { useLibraryItemLibrary } from "../skills/useLibraryItemLibrary";

type Library = ReturnType<typeof useLibraryItemLibrary>;

type CollectionTarget = {
  id: string;
  title: string;
};

function isGitHubImportDraft(value: unknown): value is GitHubImportDraft {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GitHubImportDraft>;
  return typeof candidate.repo === "string";
}

export type UseCollectionDialogsArgs = {
  library: Library;
  activeScope: string;
  setActiveScope: (scope: string) => void;
  setQuery: (query: string) => void;
};

/**
 * Encapsulates every collection-level modal (create, import from folder/archive, rename, delete)
 * plus the supporting saving/error flags. Each public handler mirrors the one that previously
 * lived in `App.tsx`, keeping the outer component close to declarative.
 */
export function useCollectionDialogs({
  library,
  activeScope,
  setActiveScope,
  setQuery,
}: UseCollectionDialogsArgs) {
  const { t } = useAppTranslation();
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [collectionSaving, setCollectionSaving] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  const [importCollectionModalOpen, setImportCollectionModalOpen] = useState(false);
  const [importCollectionSaving, setImportCollectionSaving] = useState(false);
  const [importCollectionError, setImportCollectionError] = useState<string | null>(null);
  const [importCollectionDraft, setImportCollectionDraft] = useState<GitHubImportDraft | null>(
    null
  );

  const [collectionToDelete, setCollectionToDelete] = useState<CollectionTarget | null>(null);
  const [collectionDeleting, setCollectionDeleting] = useState(false);
  const [deleteCollectionError, setDeleteCollectionError] = useState<string | null>(null);

  const [collectionToRename, setCollectionToRename] = useState<CollectionTarget | null>(null);
  const [renameCollectionError, setRenameCollectionError] = useState<string | null>(null);

  const openCreateModal = useCallback(() => {
    setCollectionError(null);
    setCollectionModalOpen(true);
  }, []);

  const openImportModal = useCallback((draft?: GitHubImportDraft | null) => {
    setImportCollectionError(null);
    setImportCollectionDraft(isGitHubImportDraft(draft) ? draft : null);
    setImportCollectionModalOpen(true);
  }, []);

  const requestRename = useCallback((collection: CollectionTarget) => {
    setRenameCollectionError(null);
    setCollectionToRename(collection);
  }, []);

  const requestDelete = useCallback((collection: CollectionTarget) => {
    setDeleteCollectionError(null);
    setCollectionToDelete(collection);
  }, []);

  const handleCreate = useCallback(
    async (name: string) => {
      setCollectionSaving(true);
      setCollectionError(null);
      try {
        const collection = await library.createCollection(name);
        if (!collection) {
          setCollectionError(t("collection.error.create"));
          return false;
        }

        library.clearActiveSkill();
        setActiveScope(`collection:${collection.id}`);
        setCollectionModalOpen(false);
        notify.success(t("collection.notification.created.message", { name: collection.title }), {
          title: t("collection.notification.created.title"),
        });
        return true;
      } finally {
        setCollectionSaving(false);
      }
    },
    [library, setActiveScope, t]
  );

  const handleDelete = useCallback(async () => {
    if (!collectionToDelete) return;
    setCollectionDeleting(true);
    setDeleteCollectionError(null);
    try {
      const deleted = await library.deleteCollection(collectionToDelete.id);
      if (!deleted) {
        setDeleteCollectionError(t("collection.error.delete"));
        return;
      }
      if (activeScope === `collection:${collectionToDelete.id}`) {
        setActiveScope("all");
      }
      notify.info(
        t("collection.notification.deleted.message", { name: collectionToDelete.title }),
        {
          title: t("collection.notification.deleted.title"),
        }
      );
      setCollectionToDelete(null);
    } finally {
      setCollectionDeleting(false);
    }
  }, [activeScope, collectionToDelete, library, setActiveScope, t]);

  const handleRename = useCallback(
    async (name: string) => {
      if (!collectionToRename) return null;
      const renamed = await library.renameCollection(collectionToRename.id, name);
      if (!renamed) {
        setRenameCollectionError(t("collection.error.rename"));
        return null;
      }
      setRenameCollectionError(null);
      setCollectionToRename(null);
      setActiveScope(`collection:${renamed.id}`);
      notify.success(t("collection.notification.renamed.message", { name: renamed.title }), {
        title: t("collection.notification.renamed.title"),
      });
      return renamed;
    },
    [collectionToRename, library, setActiveScope, t]
  );

  const completeImport = useCallback(
    async (
      importCollection: () => Promise<LibraryItemCollectionSummary>,
      fallbackMessage: string,
      loadingMessage: string
    ): Promise<boolean> => {
      setImportCollectionSaving(true);
      setImportCollectionError(null);
      const toastId = `import-collection-${Date.now()}`;
      notify.loading(loadingMessage, {
        id: toastId,
        title: t("import.notification.importing.title"),
      });
      try {
        const collection = await importCollection();
        library.clearActiveSkill();
        setQuery("");
        setActiveScope(`collection:${collection.id}`);
        setImportCollectionDraft(null);
        setImportCollectionModalOpen(false);
        notify.update(
          toastId,
          "success",
          t("import.notification.imported.message", { name: collection.title }),
          {
            title: t("import.notification.imported.title"),
          }
        );
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : fallbackMessage;
        setImportCollectionError(message);
        notify.update(toastId, "error", message, { title: t("import.notification.failed.title") });
        return false;
      } finally {
        setImportCollectionSaving(false);
      }
    },
    [library, setActiveScope, setQuery, t]
  );

  const handleImportFolder = useCallback(
    (input: { name: string; sourcePath: string }) =>
      completeImport(
        () => library.importCollection(input),
        t("import.error.generic"),
        t("import.notification.importingFolder", { path: input.sourcePath })
      ),
    [completeImport, library, t]
  );

  const handleImportArchive = useCallback(
    (input: { name: string; archivePath: string }) =>
      completeImport(
        () => library.importCollectionArchive(input),
        t("import.error.archive"),
        t("import.notification.importingArchive", { name: input.name })
      ),
    [completeImport, library, t]
  );

  const handleImportGitHub = useCallback(
    (input: { name: string; repo: string; ref?: string; path?: string }) =>
      completeImport(
        () => library.importCollectionFromGitHub(input),
        t("import.error.github"),
        t("import.notification.importingGithub", {
          source: `${input.repo}${input.path ? `/${input.path}` : ""}`,
        })
      ),
    [completeImport, library, t]
  );

  const handleExport = useCallback(
    async (collection: CollectionTarget) => {
      const destinationFolder = await appRpc.request.pickCollectionExportFolder();
      if (!destinationFolder) return;
      const toastId = `export-collection-${collection.id}-${Date.now()}`;
      notify.loading(t("collection.notification.exporting.message", { name: collection.title }), {
        id: toastId,
        title: t("collection.notification.exporting.title"),
      });
      try {
        const result = await library.exportCollectionArchive({
          collectionId: collection.id,
          destinationFolder,
        });
        notify.update(
          toastId,
          "success",
          t("collection.notification.exported.message", {
            name: collection.title,
            path: result.archivePath,
          }),
          { title: t("collection.notification.exported.title") }
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t("collection.notification.exportFailed.message");
        notify.update(toastId, "error", message, {
          title: t("collection.notification.exportFailed.title"),
        });
      }
    },
    [library, t]
  );

  const closeCreateModal = useCallback(() => setCollectionModalOpen(false), []);
  const closeImportModal = useCallback(() => {
    setImportCollectionModalOpen(false);
    setImportCollectionDraft(null);
  }, []);
  const clearImportError = useCallback(() => setImportCollectionError(null), []);
  const closeRenameModal = useCallback(() => {
    setRenameCollectionError(null);
    setCollectionToRename(null);
  }, []);
  const closeDeleteDialog = useCallback(() => {
    setDeleteCollectionError(null);
    setCollectionToDelete(null);
  }, []);

  return {
    create: {
      opened: collectionModalOpen,
      saving: collectionSaving,
      errorMessage: collectionError,
      open: openCreateModal,
      close: closeCreateModal,
      onCreate: handleCreate,
    },
    import: {
      opened: importCollectionModalOpen,
      saving: importCollectionSaving,
      errorMessage: importCollectionError,
      draft: importCollectionDraft,
      open: openImportModal,
      close: closeImportModal,
      clearError: clearImportError,
      onPickFolder: () => appRpc.request.pickImportFolder(),
      onPickArchive: () => appRpc.request.pickImportArchive(),
      onImportFolder: handleImportFolder,
      onImportArchive: handleImportArchive,
      onImportGitHub: handleImportGitHub,
    },
    rename: {
      target: collectionToRename,
      errorMessage: renameCollectionError,
      request: requestRename,
      close: closeRenameModal,
      onRename: handleRename,
    },
    delete: {
      target: collectionToDelete,
      deleting: collectionDeleting,
      errorMessage: deleteCollectionError,
      request: requestDelete,
      close: closeDeleteDialog,
      onDelete: handleDelete,
    },
    onExport: handleExport,
  };
}

export type CollectionDialogs = ReturnType<typeof useCollectionDialogs>;
