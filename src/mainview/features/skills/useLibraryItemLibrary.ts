import { appRpc, onAppMessage } from "@mainview-bridge";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ImportCollectionFromGitHubInput } from "../../../shared/githubImport";
import type {
  CreateLibraryItemInput,
  EditorViewMode,
  ExportCollectionArchiveInput,
  ExportCollectionArchiveResult,
  ImportCollectionFromArchiveInput,
  ImportCollectionFromPathInput,
  LibraryItemCollectionSummary,
  LibraryItemDocument,
  LibraryItemSummary,
} from "../../../shared/types";
import { useAppTranslation } from "../../i18n/i18n";
import { isAdditionalFilesTab } from "../editor/constants";
import {
  buildDraftMap,
  clearDraftsForLibraryItem,
  type DraftMap,
  dirtyFilesForDocument,
  draftsForDocument,
  type LoadState,
  pruneDraftsForKnownLibraryItems,
  writeDraft,
} from "../editor/drafts";
import { notify } from "../notifications/notify";
import { type LibraryItemListSource, useLibraryIndexes } from "./useLibraryIndexes";
import { useLibraryItemViewModeIntent } from "./useLibraryItemViewModeIntent";
import { useUnsavedLibraryItemNavigation } from "./useUnsavedLibraryItemNavigation";

function upsertLibraryItemSummary(items: LibraryItemSummary[], nextItem: LibraryItemSummary) {
  const nextItems = items.some((item) => item.id === nextItem.id)
    ? items.map((item) => (item.id === nextItem.id ? nextItem : item))
    : [...items, nextItem];
  return nextItems.sort(
    (a, b) => a.title.localeCompare(b.title) || a.entryPath.localeCompare(b.entryPath)
  );
}

function replaceLibraryItemSummary(
  items: LibraryItemSummary[],
  previousId: string,
  nextItem: LibraryItemSummary
) {
  const nextItems = items.filter((item) => item.id !== previousId && item.id !== nextItem.id);
  return [...nextItems, nextItem].sort(
    (a, b) => a.title.localeCompare(b.title) || a.entryPath.localeCompare(b.entryPath)
  );
}

function upsertCollectionSummary(
  collections: LibraryItemCollectionSummary[],
  nextCollection: LibraryItemCollectionSummary
) {
  const nextCollections = collections.some((collection) => collection.id === nextCollection.id)
    ? collections.map((collection) =>
        collection.id === nextCollection.id ? nextCollection : collection
      )
    : [...collections, nextCollection];
  return nextCollections.sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

/**
 * Owns the local libraryItem editing loop: discovery, active document loading, drafts, saves,
 * refreshes, and filesystem update events from the backend.
 */
export function useLibraryItemLibrary(defaultEditorMode: EditorViewMode = "preview") {
  const { t } = useAppTranslation();
  const { collectionList, loadLibraryIndexes, setCollectionList, setSkillList, libraryItemList } =
    useLibraryIndexes();
  const [activeLibraryItemId, setActiveSkillId] = useState<string | null>(null);
  const [activeLibraryItem, setActiveSkill] = useState<LibraryItemDocument | null>(null);
  const [draftsByFile, setDraftsByFile] = useState<DraftMap>({});
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [refreshingSkills, setRefreshingSkills] = useState(false);
  const activeSkillIdRef = useRef<string | null>(null);
  const loadedSkillIdRef = useRef<string | null>(null);
  const loadSkillRequestSequenceRef = useRef(0);
  const nextLoadedDocumentViewModeRef = useRef<{
    itemId: string;
    mode: EditorViewMode;
  } | null>(null);
  const { pushViewModeIntent, viewModeIntent } = useLibraryItemViewModeIntent();

  /**
   * Wraps a backend mutation with the hook's standard status/error bookkeeping and returns
   * `null` when it fails. Use this for user-triggered actions that should surface failures
   * via the `error` state (e.g. list screens with a toast/banner).
   */
  const runReportingMutation = useCallback(
    async <T>(
      options: { status?: "loading" | "saving"; fallbackMessage: string },
      fn: () => Promise<T>
    ): Promise<T | null> => {
      setStatus(options.status ?? "loading");
      try {
        const result = await fn();
        setError(null);
        setStatus("idle");
        return result;
      } catch (nextError) {
        setStatus("error");
        setError(nextError instanceof Error ? nextError.message : options.fallbackMessage);
        return null;
      }
    },
    []
  );

  /**
   * Wraps a backend mutation that should surface failures by re-throwing (so the dialog
   * that launched it can render an inline error). Resets status to "idle" on failure so
   * the UI is ready for another attempt.
   */
  const runThrowingMutation = useCallback(
    async <T>(
      options: { status?: "loading" | "saving"; fallbackMessage: string },
      fn: () => Promise<T>
    ): Promise<T> => {
      setStatus(options.status ?? "saving");
      try {
        const result = await fn();
        setStatus("idle");
        return result;
      } catch (nextError) {
        setStatus("idle");
        throw nextError instanceof Error ? nextError : new Error(options.fallbackMessage);
      }
    },
    []
  );

  const loadSkillList = useCallback(
    async (preferredId?: string, source: LibraryItemListSource = "list") => {
      setStatus("loading");
      try {
        const { nextSkills } = await loadLibraryIndexes(source);
        const nextSkillId =
          preferredId && nextSkills.some((libraryItem) => libraryItem.id === preferredId)
            ? preferredId
            : (nextSkills[0]?.id ?? null);
        activeSkillIdRef.current = nextSkillId;
        setActiveSkillId(nextSkillId);
        setError(null);
        setStatus("idle");
        return nextSkillId;
      } catch (nextError) {
        setStatus("error");
        const message = nextError instanceof Error ? nextError.message : t("item.error.load");
        setError(message);
        notify.error(message, { title: t("library.heading") });
        return null;
      }
    },
    [loadLibraryIndexes, t]
  );

  const loadSkill = useCallback(
    async (id: string) => {
      const requestSequence = ++loadSkillRequestSequenceRef.current;
      setStatus("loading");
      try {
        let nextLibraryItem: LibraryItemDocument;
        try {
          nextLibraryItem = await appRpc.request.readLibraryItem({ id });
        } catch (readError) {
          if ((readError as { code?: unknown }).code !== "skill-not-found") throw readError;

          const refreshedLibraryItems = await appRpc.request.refreshLibraryItems();
          setSkillList(refreshedLibraryItems);
          nextLibraryItem = await appRpc.request.readLibraryItem({ id });
        }
        if (
          activeSkillIdRef.current !== id ||
          loadSkillRequestSequenceRef.current !== requestSequence
        ) {
          return;
        }
        const isOpeningDifferentItem = loadedSkillIdRef.current !== id;
        setActiveSkill(nextLibraryItem);
        loadedSkillIdRef.current = id;
        setDraftsByFile((currentDrafts) => buildDraftMap(nextLibraryItem, currentDrafts));
        setActiveFilePath((currentPath) => {
          if (isAdditionalFilesTab(currentPath)) {
            return currentPath;
          }
          if (
            currentPath &&
            nextLibraryItem.files.some((file) => file.relativePath === currentPath)
          ) {
            return currentPath;
          }
          return nextLibraryItem.files[0]?.relativePath ?? null;
        });
        setError(null);
        setStatus("idle");
        const nextViewMode =
          nextLoadedDocumentViewModeRef.current?.itemId === id
            ? nextLoadedDocumentViewModeRef.current.mode
            : isOpeningDifferentItem
              ? defaultEditorMode
              : null;
        if (nextLoadedDocumentViewModeRef.current?.itemId === id) {
          nextLoadedDocumentViewModeRef.current = null;
        }
        if (nextViewMode) pushViewModeIntent(nextViewMode);
      } catch (nextError) {
        if (
          activeSkillIdRef.current !== id ||
          loadSkillRequestSequenceRef.current !== requestSequence
        ) {
          return;
        }
        setStatus("error");
        const message = nextError instanceof Error ? nextError.message : t("item.error.open");
        setError(message);
        notify.error(message, { title: t("library.notification.openItem") });
      }
    },
    [defaultEditorMode, pushViewModeIntent, setSkillList, t]
  );

  const refreshLibraryItems = useCallback(() => {
    void (async () => {
      setRefreshingSkills(true);
      try {
        await loadSkillList(activeLibraryItemId ?? undefined, "refresh");
      } finally {
        setRefreshingSkills(false);
      }
    })();
  }, [activeLibraryItemId, loadSkillList]);

  const createCollection = useCallback(
    async (name: string) =>
      runReportingMutation({ fallbackMessage: t("collection.error.create") }, async () => {
        const collection = await appRpc.request.createCollection({ name });
        setCollectionList((collections) => upsertCollectionSummary(collections, collection));
        return collection;
      }),
    [runReportingMutation, setCollectionList, t]
  );

  const importCollection = useCallback(
    async (input: ImportCollectionFromPathInput) =>
      runThrowingMutation(
        { status: "loading", fallbackMessage: t("import.error.generic") },
        async () => {
          const collection = await appRpc.request.importCollection(input);
          await loadLibraryIndexes("refresh");
          return collection;
        }
      ),
    [loadLibraryIndexes, runThrowingMutation, t]
  );

  const importCollectionArchive = useCallback(
    async (input: ImportCollectionFromArchiveInput) =>
      runThrowingMutation(
        { status: "loading", fallbackMessage: t("import.error.archive") },
        async () => {
          const collection = await appRpc.request.importCollectionArchive(input);
          await loadLibraryIndexes("refresh");
          return collection;
        }
      ),
    [loadLibraryIndexes, runThrowingMutation, t]
  );

  const importCollectionFromGitHub = useCallback(
    async (input: ImportCollectionFromGitHubInput) =>
      runThrowingMutation(
        { status: "loading", fallbackMessage: t("import.error.github") },
        async () => {
          const collection = await appRpc.request.importCollectionFromGitHub(input);
          await loadLibraryIndexes("refresh");
          return collection;
        }
      ),
    [loadLibraryIndexes, runThrowingMutation, t]
  );

  const exportCollectionArchive = useCallback(
    async (input: ExportCollectionArchiveInput): Promise<ExportCollectionArchiveResult> =>
      runThrowingMutation(
        { fallbackMessage: t("collection.notification.exportFailed.message") },
        async () => appRpc.request.exportCollectionArchive(input)
      ),
    [runThrowingMutation, t]
  );

  const deleteCollection = useCallback(
    async (collectionId: string) => {
      const result = await runReportingMutation(
        { fallbackMessage: t("collection.error.delete") },
        async () => {
          const { collections, libraryItems } = await appRpc.request.deleteCollection({
            id: collectionId,
          });
          setCollectionList(collections);
          setSkillList(libraryItems);
          return true;
        }
      );
      return result === true;
    },
    [runReportingMutation, setCollectionList, setSkillList, t]
  );

  const renameCollection = useCallback(
    async (collectionId: string, name: string) =>
      runReportingMutation({ fallbackMessage: t("collection.error.rename") }, async () => {
        const renamedCollection = await appRpc.request.renameCollection({
          id: collectionId,
          name,
        });
        const { nextSkills } = await loadLibraryIndexes("refresh");

        const activeItemBelongsToCollection = activeLibraryItem?.item.collectionId === collectionId;
        const nextKnownIds = nextSkills.map((libraryItem) => libraryItem.id);

        if (activeItemBelongsToCollection) {
          setActiveSkillId(null);
          setActiveSkill(null);
          setDraftsByFile((drafts) => pruneDraftsForKnownLibraryItems(drafts, nextKnownIds));
          setActiveFilePath(null);
        } else {
          const nextSkillId =
            activeLibraryItemId &&
            nextSkills.some((libraryItem) => libraryItem.id === activeLibraryItemId)
              ? activeLibraryItemId
              : null;
          setActiveSkillId(nextSkillId);
          if (!nextSkillId) {
            setActiveSkill(null);
            setDraftsByFile((drafts) => pruneDraftsForKnownLibraryItems(drafts, nextKnownIds));
            setActiveFilePath(null);
          }
        }

        return renamedCollection;
      }),
    [activeLibraryItem, activeLibraryItemId, loadLibraryIndexes, runReportingMutation, t]
  );

  const createLibraryItem = useCallback(
    async (input: CreateLibraryItemInput) =>
      runReportingMutation({ fallbackMessage: t("item.error.createGeneric") }, async () => {
        const createdLibraryItem = await appRpc.request.createLibraryItem(input);
        nextLoadedDocumentViewModeRef.current = {
          itemId: createdLibraryItem.id,
          mode: "edit",
        };
        setSkillList((items) => upsertLibraryItemSummary(items, createdLibraryItem));
        activeSkillIdRef.current = createdLibraryItem.id;
        setActiveSkillId(createdLibraryItem.id);
        return createdLibraryItem;
      }),
    [runReportingMutation, setSkillList, t]
  );

  const renameLibraryItem = useCallback(
    async (name: string, targetId = activeLibraryItem?.item.id ?? null) => {
      if (!targetId) return null;
      const renamingActiveItem = activeLibraryItem?.item.id === targetId;
      if (renamingActiveItem && dirtyFilesForDocument(activeLibraryItem, draftsByFile).length > 0) {
        throw new Error(t("item.error.saveBeforeRename", { kind: activeLibraryItem.item.kind }));
      }

      setStatus("saving");
      try {
        const nextDocument = await appRpc.request.renameLibraryItem({
          id: targetId,
          name,
        });
        const { nextSkills } = await loadLibraryIndexes("list");
        if (renamingActiveItem && activeLibraryItem) {
          activeSkillIdRef.current = nextDocument.item.id;
          setActiveSkillId(nextDocument.item.id);
          setActiveSkill(nextDocument);
          setDraftsByFile((currentDrafts) =>
            buildDraftMap(
              nextDocument,
              clearDraftsForLibraryItem(activeLibraryItem.item.id, currentDrafts)
            )
          );
          setActiveFilePath((currentPath) => {
            if (isAdditionalFilesTab(currentPath)) return currentPath;
            if (
              currentPath &&
              nextDocument.files.some((file) => file.relativePath === currentPath)
            ) {
              return currentPath;
            }
            return nextDocument.files[0]?.relativePath ?? null;
          });
        } else if (
          activeLibraryItemId &&
          !nextSkills.some((libraryItem) => libraryItem.id === activeLibraryItemId)
        ) {
          activeSkillIdRef.current = null;
          setActiveSkillId(null);
          setActiveSkill(null);
          setDraftsByFile((drafts) =>
            pruneDraftsForKnownLibraryItems(
              drafts,
              nextSkills.map((libraryItem) => libraryItem.id)
            )
          );
          setActiveFilePath(null);
        }
        setError(nextDocument.warnings?.length ? nextDocument.warnings.join(" ") : null);
        setStatus("idle");
        return nextDocument;
      } catch (nextError) {
        setStatus("idle");
        throw nextError instanceof Error ? nextError : new Error(t("item.error.rename"));
      }
    },
    [activeLibraryItem, activeLibraryItemId, draftsByFile, loadLibraryIndexes, t]
  );

  const moveLibraryItem = useCallback(
    async (collectionId: string, targetId = activeLibraryItem?.item.id ?? null) => {
      if (!targetId) return null;
      const movingActiveItem = activeLibraryItem?.item.id === targetId;
      if (movingActiveItem && dirtyFilesForDocument(activeLibraryItem, draftsByFile).length > 0) {
        throw new Error(t("item.error.saveBeforeMove", { kind: activeLibraryItem.item.kind }));
      }

      setStatus("saving");
      try {
        const nextDocument = await appRpc.request.moveLibraryItem({
          id: targetId,
          collectionId,
        });
        setSkillList((items) => replaceLibraryItemSummary(items, targetId, nextDocument.item));
        if (movingActiveItem && activeLibraryItem) {
          activeSkillIdRef.current = nextDocument.item.id;
          setActiveSkillId(nextDocument.item.id);
          setActiveSkill(nextDocument);
          setDraftsByFile((currentDrafts) =>
            buildDraftMap(
              nextDocument,
              clearDraftsForLibraryItem(activeLibraryItem.item.id, currentDrafts)
            )
          );
          setActiveFilePath((currentPath) => {
            if (isAdditionalFilesTab(currentPath)) return currentPath;
            if (
              currentPath &&
              nextDocument.files.some((file) => file.relativePath === currentPath)
            ) {
              return currentPath;
            }
            return nextDocument.files[0]?.relativePath ?? null;
          });
        }
        setError(nextDocument.warnings?.length ? nextDocument.warnings.join(" ") : null);
        setStatus("idle");
        return nextDocument;
      } catch (nextError) {
        setStatus("idle");
        throw nextError instanceof Error ? nextError : new Error(t("item.error.moveGeneric"));
      }
    },
    [activeLibraryItem, draftsByFile, setSkillList, t]
  );

  const createLibraryItemFile = useCallback(
    async (name: string) => {
      if (!activeLibraryItem) return null;
      return runThrowingMutation({ fallbackMessage: t("file.error.create") }, async () => {
        nextLoadedDocumentViewModeRef.current = {
          itemId: activeLibraryItem.item.id,
          mode: "edit",
        };
        pushViewModeIntent("edit");
        const nextDocument = await appRpc.request.createLibraryItemFile({
          id: activeLibraryItem.item.id,
          name,
        });
        setActiveSkill(nextDocument);
        setSkillList((items) => upsertLibraryItemSummary(items, nextDocument.item));
        setDraftsByFile((currentDrafts) => buildDraftMap(nextDocument, currentDrafts));
        const createdFile = nextDocument.files.find(
          (file) => file.relativePath === name.trim() || file.relativePath === `${name.trim()}.md`
        );
        setActiveFilePath(createdFile?.relativePath ?? nextDocument.files[0]?.relativePath ?? null);
        pushViewModeIntent("edit");
        return nextDocument;
      });
    },
    [activeLibraryItem, pushViewModeIntent, runThrowingMutation, setSkillList, t]
  );

  const renameLibraryItemFile = useCallback(
    async (relativePath: string, name: string) => {
      if (!activeLibraryItem) return null;
      if (dirtyFilesForDocument(activeLibraryItem, draftsByFile).length > 0) {
        throw new Error(t("file.error.saveBeforeRename"));
      }

      return runThrowingMutation({ fallbackMessage: t("file.error.rename") }, async () => {
        const previousPaths = new Set(activeLibraryItem.files.map((file) => file.relativePath));
        const nextDocument = await appRpc.request.renameLibraryItemFile({
          id: activeLibraryItem.item.id,
          relativePath,
          name,
        });
        const renamedPath =
          nextDocument.files.find((file) => !previousPaths.has(file.relativePath))?.relativePath ??
          nextDocument.files[0]?.relativePath ??
          null;

        setActiveSkill(nextDocument);
        setSkillList((items) => upsertLibraryItemSummary(items, nextDocument.item));
        setDraftsByFile((currentDrafts) =>
          buildDraftMap(
            nextDocument,
            clearDraftsForLibraryItem(activeLibraryItem.item.id, currentDrafts)
          )
        );
        setActiveFilePath(renamedPath);
        return nextDocument;
      });
    },
    [activeLibraryItem, draftsByFile, runThrowingMutation, setSkillList, t]
  );

  const uploadLibraryItemFiles = useCallback(
    async (files: Array<{ name: string; contentBase64: string }>) => {
      if (!activeLibraryItem || files.length === 0) return null;
      return runThrowingMutation({ fallbackMessage: t("file.error.upload") }, async () => {
        const nextDocument = await appRpc.request.uploadLibraryItemFiles({
          id: activeLibraryItem.item.id,
          files,
        });
        setActiveSkill(nextDocument);
        setSkillList((items) => upsertLibraryItemSummary(items, nextDocument.item));
        setDraftsByFile((currentDrafts) => buildDraftMap(nextDocument, currentDrafts));
        return nextDocument;
      });
    },
    [activeLibraryItem, runThrowingMutation, setSkillList, t]
  );

  const renameAdditionalLibraryItemFile = useCallback(
    async (relativePath: string, name: string) => {
      if (!activeLibraryItem) return null;
      return runThrowingMutation(
        { fallbackMessage: t("file.error.renameAdditional") },
        async () => {
          const nextDocument = await appRpc.request.renameAdditionalLibraryItemFile({
            id: activeLibraryItem.item.id,
            relativePath,
            name,
          });
          setActiveSkill(nextDocument);
          setSkillList((items) => upsertLibraryItemSummary(items, nextDocument.item));
          setDraftsByFile((currentDrafts) => buildDraftMap(nextDocument, currentDrafts));
          return nextDocument;
        }
      );
    },
    [activeLibraryItem, runThrowingMutation, setSkillList, t]
  );

  const deleteAdditionalLibraryItemFile = useCallback(
    async (relativePath: string) => {
      if (!activeLibraryItem) return null;
      return runThrowingMutation(
        { fallbackMessage: t("file.error.deleteAdditional") },
        async () => {
          const nextDocument = await appRpc.request.deleteAdditionalLibraryItemFile({
            id: activeLibraryItem.item.id,
            relativePath,
          });
          setActiveSkill(nextDocument);
          setSkillList((items) => upsertLibraryItemSummary(items, nextDocument.item));
          setDraftsByFile((currentDrafts) => buildDraftMap(nextDocument, currentDrafts));
          return nextDocument;
        }
      );
    },
    [activeLibraryItem, runThrowingMutation, setSkillList, t]
  );

  const deleteLibraryItemFile = useCallback(
    async (relativePath: string) => {
      if (!activeLibraryItem) return null;
      return runThrowingMutation({ fallbackMessage: t("file.error.delete") }, async () => {
        const nextDocument = await appRpc.request.deleteLibraryItemFile({
          id: activeLibraryItem.item.id,
          relativePath,
        });
        setActiveSkill(nextDocument);
        setSkillList((items) => upsertLibraryItemSummary(items, nextDocument.item));
        setDraftsByFile((currentDrafts) => buildDraftMap(nextDocument, currentDrafts));
        setActiveFilePath(nextDocument.files[0]?.relativePath ?? null);
        return nextDocument;
      });
    },
    [activeLibraryItem, runThrowingMutation, setSkillList, t]
  );

  const deleteLibraryItem = useCallback(
    async (itemId: string) => {
      const result = await runReportingMutation(
        { fallbackMessage: t("item.error.deleteGeneric") },
        async () => {
          const [nextSkills, nextCollections] = await Promise.all([
            appRpc.request.deleteLibraryItem({ id: itemId }),
            appRpc.request.listCollections(),
          ]);
          setSkillList(nextSkills);
          setCollectionList(nextCollections);
          const nextSkillId = nextSkills[0]?.id ?? null;
          activeSkillIdRef.current = nextSkillId;
          setActiveSkillId(nextSkillId);
          if (!nextSkillId) {
            setActiveSkill(null);
            setDraftsByFile((drafts) =>
              pruneDraftsForKnownLibraryItems(
                drafts,
                nextSkills.map((libraryItem) => libraryItem.id)
              )
            );
            setActiveFilePath(null);
          }
          return true;
        }
      );
      return result === true;
    },
    [runReportingMutation, setCollectionList, setSkillList, t]
  );

  /** Clears the selected document and its local editing state immediately. */
  const clearActiveSkill = useCallback(() => {
    activeSkillIdRef.current = null;
    loadedSkillIdRef.current = null;
    setActiveSkillId(null);
    setActiveSkill(null);
    setDraftsByFile({});
    setActiveFilePath(null);
  }, []);

  const saveCurrentFile = useCallback(async () => {
    const currentFile =
      activeLibraryItem?.files.find((file) => file.relativePath === activeFilePath) ??
      activeLibraryItem?.files[0] ??
      null;
    if (!activeLibraryItem || !currentFile) return;

    const activeDrafts = draftsForDocument(activeLibraryItem, draftsByFile);
    setStatus("saving");
    try {
      const savedLibraryItem = await appRpc.request.saveLibraryItem({
        id: activeLibraryItem.item.id,
        relativePath: currentFile.relativePath,
        content: activeDrafts[currentFile.relativePath] ?? currentFile.content,
      });
      setActiveSkill(savedLibraryItem);
      setDraftsByFile((currentDrafts) => buildDraftMap(savedLibraryItem, currentDrafts));
      setSkillList((items) => upsertLibraryItemSummary(items, savedLibraryItem.item));
      if (savedLibraryItem.warnings?.length) {
        notify.warning(savedLibraryItem.warnings.join(" "), { title: t("metadata.warningTitle") });
      }
      setError(null);
      setStatus("idle");
    } catch (nextError) {
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : t("details.error.save"));
    }
  }, [activeFilePath, activeLibraryItem, draftsByFile, setSkillList, t]);

  const saveAllFiles = useCallback(async () => {
    if (!activeLibraryItem) return;

    const changedFiles = dirtyFilesForDocument(activeLibraryItem, draftsByFile);
    if (changedFiles.length === 0) return;

    const activeDrafts = draftsForDocument(activeLibraryItem, draftsByFile);
    setStatus("saving");
    try {
      const savedLibraryItem = await appRpc.request.saveLibraryItemFiles({
        id: activeLibraryItem.item.id,
        files: changedFiles.map((file) => ({
          relativePath: file.relativePath,
          content: activeDrafts[file.relativePath] ?? file.content,
        })),
      });
      setActiveSkill(savedLibraryItem);
      setDraftsByFile((currentDrafts) => buildDraftMap(savedLibraryItem, currentDrafts));
      setSkillList((items) => upsertLibraryItemSummary(items, savedLibraryItem.item));
      if (savedLibraryItem.warnings?.length) {
        notify.warning(savedLibraryItem.warnings.join(" "), { title: t("metadata.warningTitle") });
      }
      setError(null);
      setStatus("idle");
    } catch (nextError) {
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : t("details.error.saveAll"));
    }
  }, [activeLibraryItem, draftsByFile, setSkillList, t]);

  const navigation = useUnsavedLibraryItemNavigation({
    activeLibraryItem,
    activeLibraryItemId,
    defaultEditorMode,
    draftsByFile,
    pushViewModeIntent,
    saveAllFiles,
    setActiveSkillId,
    setDraftsByFile,
  });

  const updateDraft = useCallback(
    (relativePath: string, value: string) => {
      if (!activeLibraryItem) return;
      setDraftsByFile((currentDrafts) =>
        writeDraft(activeLibraryItem, currentDrafts, relativePath, value)
      );
    },
    [activeLibraryItem]
  );

  useEffect(() => {
    activeSkillIdRef.current = activeLibraryItemId;
  }, [activeLibraryItemId]);

  useEffect(() => {
    void loadSkillList();
  }, [loadSkillList]);

  useEffect(() => {
    if (!activeLibraryItemId) {
      loadedSkillIdRef.current = null;
      setActiveSkill(null);
      setDraftsByFile({});
      setActiveFilePath(null);
      return;
    }
    void loadSkill(activeLibraryItemId);
  }, [activeLibraryItemId, loadSkill]);

  useEffect(() => {
    return onAppMessage("libraryItemsUpdated", async ({ libraryItems }) => {
      setSkillList(libraryItems);
      setCollectionList(await appRpc.request.listCollections());
      // Drop drafts whose owning libraryItem was removed on disk to avoid unbounded draft growth.
      const knownLibraryItemIds = libraryItems.map((libraryItem) => libraryItem.id);
      setDraftsByFile((currentDrafts) =>
        pruneDraftsForKnownLibraryItems(currentDrafts, knownLibraryItemIds)
      );
      const currentLibraryItemId = activeSkillIdRef.current;
      const nextSkillId =
        currentLibraryItemId &&
        libraryItems.some((libraryItem) => libraryItem.id === currentLibraryItemId)
          ? currentLibraryItemId
          : null;

      activeSkillIdRef.current = nextSkillId;
      setActiveSkillId(nextSkillId);

      if (!nextSkillId) {
        setActiveSkill(null);
        setDraftsByFile({});
        setActiveFilePath(null);
        return;
      }

      if (nextSkillId === currentLibraryItemId) {
        await loadSkill(nextSkillId);
      }
    });
  }, [loadSkill, setCollectionList, setSkillList]);

  const activeDrafts = useMemo(
    () => draftsForDocument(activeLibraryItem, draftsByFile),
    [activeLibraryItem, draftsByFile]
  );
  const changedFiles = useMemo(
    () => dirtyFilesForDocument(activeLibraryItem, draftsByFile),
    [activeLibraryItem, draftsByFile]
  );
  const currentFile =
    activeLibraryItem?.files.find((file) => file.relativePath === activeFilePath) ??
    (activeFilePath ? null : (activeLibraryItem?.files[0] ?? null));
  const currentFileHasChanges = currentFile
    ? changedFiles.some((file) => file.relativePath === currentFile.relativePath)
    : false;

  return {
    activeDrafts,
    activeFilePath,
    activeLibraryItem,
    activeLibraryItemId,
    cancelNavigation: navigation.cancelNavigation,
    changedFiles,
    clearActiveSkill,
    collectionList,
    confirmSaveAndNavigate: navigation.confirmSaveAndNavigate,
    createCollection,
    exportCollectionArchive,
    importCollection,
    importCollectionArchive,
    importCollectionFromGitHub,
    createLibraryItemFile,
    createLibraryItem,
    moveLibraryItem,
    renameLibraryItem,
    renameLibraryItemFile,
    renameAdditionalLibraryItemFile,
    currentFile,
    currentFileHasChanges,
    deleteLibraryItem,
    deleteLibraryItemFile,
    discardAndNavigate: navigation.discardAndNavigate,
    deleteCollection,
    deleteAdditionalLibraryItemFile,
    error,
    hasUnsavedChanges: navigation.hasUnsavedChanges,
    loadSkillList,
    refreshingSkills,
    refreshLibraryItems,
    renameCollection,
    requestSkillChange: navigation.requestSkillChange,
    saveAllFiles,
    saveCurrentFile,
    setActiveFilePath,
    setActiveSkillId,
    setError,
    libraryItemList,
    status,
    unsavedDialogOpen: navigation.unsavedDialogOpen,
    uploadLibraryItemFiles,
    updateDraft,
    viewModeIntent,
  };
}
