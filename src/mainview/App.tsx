import { appRpc, onAppMessage } from "@mainview-bridge";
import { useMediaQuery } from "@mantine/hooks";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toolPresetById } from "../shared/toolPresets";
import type { AppLanguage, LibraryItemSummary } from "../shared/types";
import { UnsavedChangesDialog } from "./components/UnsavedChangesDialog";
import { LibraryItemDetails } from "./features/editor/LibraryItemDetails";
import type {
  EditorHandle,
  LibraryItemDetailsFileActions,
  LibraryItemDetailsSaveState,
  LibraryItemDetailsTooling,
} from "./features/editor/types";
import { useScopeState } from "./features/layout/useScopeState";
import { useSplitPane } from "./features/layout/useSplitPane";
import { AppSidebar } from "./features/navigation/AppSidebar";
import { CreateCollectionModal } from "./features/navigation/CreateCollectionModal";
import { DeleteCollectionDialog } from "./features/navigation/DeleteCollectionDialog";
import { ImportCollectionModal } from "./features/navigation/ImportCollectionModal";
import { RenameCollectionModal } from "./features/navigation/RenameCollectionModal";
import { useCollectionDialogs } from "./features/navigation/useCollectionDialogs";
import { notify } from "./features/notifications/notify";
import { OnboardingTour } from "./features/onboarding/OnboardingTour";
import { SettingsModal } from "./features/settings/SettingsModal";
import { useSettingsState } from "./features/settings/useSettingsState";
import { useUpdaterState } from "./features/settings/useUpdaterState";
import { KeyboardShortcutsModal } from "./features/shortcuts/KeyboardShortcutsModal";
import { useAppShortcuts } from "./features/shortcuts/useAppShortcuts";
import { CreateLibraryItemModal } from "./features/skills/CreateLibraryItemModal";
import { DeleteLibraryItemDialog } from "./features/skills/DeleteLibraryItemDialog";
import { LibraryItemListPane } from "./features/skills/LibraryItemListPane";
import {
  buildLibraryCollections,
  buildLibraryItemSearchIndex,
  buildToolFilters,
  filterByKind,
  filterLibraryItemSearchIndex,
} from "./features/skills/libraryItems";
import { MoveLibraryItemModal } from "./features/skills/MoveLibraryItemModal";
import { RenameLibraryItemModal } from "./features/skills/RenameLibraryItemModal";
import { useLibraryItemDialogs } from "./features/skills/useLibraryItemDialogs";
import { useLibraryItemLibrary } from "./features/skills/useLibraryItemLibrary";
import { MissingToolParentDialog } from "./features/tools/MissingToolParentDialog";
import { useLibraryItemTools } from "./features/tools/useLibraryItemTools";
import { applyAppLanguage, useAppTranslation } from "./i18n/i18n";
import { measureRenderer } from "./performance";

function App() {
  const { t } = useAppTranslation();
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const editorRef = useRef<EditorHandle | null>(null);
  const largeLayout = useMediaQuery("(min-width: 901px)");
  const { containerRef, isDragging, listWidth, separatorProps } = useSplitPane(largeLayout);

  const settings = useSettingsState();
  const library = useLibraryItemLibrary(settings.appSettings?.defaultEditorMode ?? "preview");
  const updater = useUpdaterState();
  const skillTools = useLibraryItemTools({
    activeLibraryItem: library.activeLibraryItem,
    setAppSettings: settings.setAppSettings,
    setError: library.setError,
  });

  useEffect(() => {
    void settings.loadSettings();
  }, [settings.loadSettings]);

  useEffect(() => {
    return onAppMessage("autoGitBackupCompleted", (result) => {
      if (result.changed && result.pushed) {
        notify.info(t("settings.backup.notification.synced.message", { branch: result.branch }), {
          title: t("settings.backup.notification.synced.title"),
        });
        return;
      }

      notify.error(result.message || t("settings.backup.error.run"), {
        title: t("settings.backup.notification.failed.title"),
      });
    });
  }, [t]);

  useEffect(() => {
    void applyAppLanguage(
      settings.modal.opened
        ? settings.general.language
        : (settings.appSettings?.language ?? "system")
    );
  }, [settings.appSettings?.language, settings.general.language, settings.modal.opened]);

  const handleSettingsLanguageChange = useCallback(
    (nextLanguage: AppLanguage) => {
      settings.general.setLanguage(nextLanguage);
      void applyAppLanguage(nextLanguage);
    },
    [settings.general.setLanguage]
  );

  const collections = useMemo(
    () =>
      measureRenderer(
        "renderer.buildLibraryCollections",
        () => buildLibraryCollections(library.libraryItemList, library.collectionList),
        (result) => ({
          items: library.libraryItemList.length,
          collections: result.length,
        })
      ),
    [library.collectionList, library.libraryItemList]
  );
  const tools = useMemo(
    () =>
      measureRenderer(
        "renderer.buildToolFilters",
        () =>
          buildToolFilters(
            library.libraryItemList,
            settings.appSettings?.tools ?? [],
            settings.appSettings?.toolMappings ?? []
          ),
        (result) => ({
          items: library.libraryItemList.length,
          tools: result.length,
        })
      ),
    [settings.appSettings?.toolMappings, settings.appSettings?.tools, library.libraryItemList]
  );

  const scope = useScopeState(collections, tools);
  const { query, setQuery, activeScope, setActiveScope, kindFilter, setKindFilter } = scope;
  const deferredQuery = useDeferredValue(query);

  const activeCollection = activeScope.startsWith("collection:")
    ? (collections.find((collection) => collection.id === activeScope.replace("collection:", "")) ??
      null)
    : null;
  const activeTool = activeScope.startsWith("tool:")
    ? (tools.find((tool) => tool.id === activeScope.replace("tool:", "")) ?? null)
    : null;

  const scopedSkills = activeScope.startsWith("tool:")
    ? (activeTool?.items ?? [])
    : activeScope.startsWith("collection:")
      ? (activeCollection?.items ?? [])
      : library.libraryItemList;
  const collectionTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const collection of collections) {
      map.set(collection.id, collection.title);
    }
    return map;
  }, [collections]);
  /**
   * Show per-row collection labels only when the current scope can span more
   * than one collection. Within a single collection scope the sidebar already
   * tells the user which one they're in, so labels would be redundant noise.
   */
  const showItemCollections = activeScope === "all" || activeScope.startsWith("tool:");
  const syncSettingsAfterSave = settings.backup.hasUnsavedChanges && settings.backup.config.enabled;
  const activeDocumentCollectionTitle = library.activeLibraryItem
    ? (collectionTitleById.get(library.activeLibraryItem.item.collectionId) ?? null)
    : null;
  const kindScopedSkills = useMemo(
    () =>
      measureRenderer(
        "renderer.filterByKind",
        () => filterByKind(scopedSkills, kindFilter),
        (result) => ({
          input: scopedSkills.length,
          output: result.length,
          kindFilter,
        })
      ),
    [kindFilter, scopedSkills]
  );
  const searchableSkills = useMemo(
    () =>
      measureRenderer(
        "renderer.buildLibraryItemSearchIndex",
        () => buildLibraryItemSearchIndex(kindScopedSkills),
        (result) => ({ items: result.length })
      ),
    [kindScopedSkills]
  );
  const shownSkills = useMemo(
    () =>
      measureRenderer(
        "renderer.filterLibraryItemSearchIndex",
        () => filterLibraryItemSearchIndex(searchableSkills, deferredQuery),
        (result) => ({
          input: searchableSkills.length,
          output: result.length,
          queryLength: deferredQuery.trim().length,
        })
      ),
    [deferredQuery, searchableSkills]
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
    if (shownSkills.length === 0) {
      library.clearActiveSkill();
      return;
    }
    if (
      library.activeLibraryItemId &&
      shownSkills.some((skill) => skill.id === library.activeLibraryItemId)
    ) {
      return;
    }
    library.setActiveSkillId(shownSkills[0]?.id ?? null);
  }, [
    library.activeLibraryItemId,
    library.clearActiveSkill,
    library.setActiveSkillId,
    shownSkills,
  ]);

  const collectionDialogs = useCollectionDialogs({
    library,
    activeScope,
    setActiveScope,
    setQuery,
  });
  const skillDialogs = useLibraryItemDialogs({
    library,
    collections,
    activeCollectionId: activeCollection?.id ?? null,
    setActiveScope,
    setQuery,
    setKindFilter,
  });

  const handleFocusEditor = useCallback(() => editorRef.current?.focus(), []);
  const handleRevealSkill = useCallback((item: LibraryItemSummary) => {
    void appRpc.request.revealPath({ path: item.rootPath });
  }, []);
  const handleInstallTool = useCallback(
    (toolId: string) => void skillTools.runToolAction(toolId, "install"),
    [skillTools.runToolAction]
  );
  const handleRemoveTool = useCallback(
    (toolId: string) => void skillTools.runToolAction(toolId, "remove"),
    [skillTools.runToolAction]
  );
  const handleRepairTool = useCallback(
    (toolId: string) => void skillTools.runToolAction(toolId, "repair"),
    [skillTools.runToolAction]
  );
  const handleExportCollection = useCallback(
    (collection: { id: string; title: string }) => void collectionDialogs.onExport(collection),
    [collectionDialogs.onExport]
  );
  const handleOpenUpdates = useCallback(
    () => settings.modal.open("updates"),
    [settings.modal.open]
  );
  const handleOpenShortcuts = useCallback(() => setShortcutsModalOpen(true), []);

  const activeItemKind = library.activeLibraryItem?.item.kind ?? "skill";
  const libraryItemSupportsTools = Boolean(library.activeLibraryItem);
  const canSaveCurrent = library.currentFileHasChanges && Boolean(library.currentFile);
  const canSaveAll = library.changedFiles.length > 0;
  const listPermissions = useMemo(
    () => ({
      canCreate: collections.length > 0,
      canRename: Boolean(library.activeLibraryItem),
      canDelete: Boolean(library.activeLibraryItem),
      canReveal: Boolean(library.activeLibraryItem),
      canMove: collections.length > 1 && Boolean(library.activeLibraryItem),
    }),
    [collections.length, library.activeLibraryItem]
  );
  const detailsSaveState = useMemo<LibraryItemDetailsSaveState>(
    () => ({
      errorMessage: library.error,
      onSaveCurrent: library.saveCurrentFile,
      onSaveAll: library.saveAllFiles,
      saving: library.status === "saving",
      canSaveCurrent,
      canSaveAll,
    }),
    [
      canSaveAll,
      canSaveCurrent,
      library.error,
      library.saveAllFiles,
      library.saveCurrentFile,
      library.status,
    ]
  );
  const emptyToolAction = useCallback(() => {}, []);
  const detailsTooling = useMemo<LibraryItemDetailsTooling>(
    () => ({
      tools: libraryItemSupportsTools ? (settings.appSettings?.tools ?? []) : [],
      toolStatuses: libraryItemSupportsTools ? skillTools.toolStatuses : [],
      activeToolActionId: libraryItemSupportsTools ? skillTools.toolActionId : null,
      onRefreshToolStatuses: libraryItemSupportsTools
        ? skillTools.refreshToolStatuses
        : emptyToolAction,
      onInstallTool: libraryItemSupportsTools ? handleInstallTool : emptyToolAction,
      onRemoveTool: libraryItemSupportsTools ? handleRemoveTool : emptyToolAction,
      onRepairTool: libraryItemSupportsTools ? handleRepairTool : emptyToolAction,
    }),
    [
      emptyToolAction,
      handleInstallTool,
      handleRemoveTool,
      handleRepairTool,
      libraryItemSupportsTools,
      settings.appSettings?.tools,
      skillTools.refreshToolStatuses,
      skillTools.toolActionId,
      skillTools.toolStatuses,
    ]
  );
  const detailsFileActions = useMemo<LibraryItemDetailsFileActions>(
    () => ({
      onCreateFile: library.createLibraryItemFile,
      onRenameFile: library.renameLibraryItemFile,
      onUploadFiles: library.uploadLibraryItemFiles,
      onRenameAdditionalFile: library.renameAdditionalLibraryItemFile,
      onDeleteFile: library.deleteLibraryItemFile,
      onDeleteAdditionalFile: library.deleteAdditionalLibraryItemFile,
      onRevealFile: (path) => appRpc.request.revealPath({ path }),
      onOpenFile: (path) => appRpc.request.openPath({ path }),
      onRevealItemFolder: (path) => appRpc.request.revealPath({ path }),
    }),
    [
      library.createLibraryItemFile,
      library.deleteAdditionalLibraryItemFile,
      library.deleteLibraryItemFile,
      library.renameAdditionalLibraryItemFile,
      library.renameLibraryItemFile,
      library.uploadLibraryItemFiles,
    ]
  );
  const shortcutsDisabled =
    collectionDialogs.create.opened ||
    collectionDialogs.import.opened ||
    Boolean(collectionDialogs.delete.target) ||
    Boolean(collectionDialogs.rename.target) ||
    Boolean(skillDialogs.delete.target) ||
    Boolean(skillDialogs.move.target) ||
    Boolean(skillDialogs.rename.target) ||
    shortcutsModalOpen ||
    settings.modal.opened ||
    library.unsavedDialogOpen;
  const onboardingBlocked =
    shortcutsDisabled ||
    skillTools.missingParentDialog.request !== null ||
    updater.applying ||
    updater.downloading;
  const openImportCollectionModal = collectionDialogs.import.open;

  useEffect(() => {
    return onAppMessage("githubImportRequested", (draft) => {
      openImportCollectionModal(draft);
    });
  }, [openImportCollectionModal]);

  useAppShortcuts({
    enabled: !shortcutsDisabled,
    canCreateItem: collections.length > 0,
    canDeleteItem: Boolean(library.activeLibraryItem),
    canRenameItem: Boolean(library.activeLibraryItem),
    onCreateItem: skillDialogs.create.open,
    onDeleteItem: () => {
      if (library.activeLibraryItem) skillDialogs.delete.request(library.activeLibraryItem.item);
    },
    onFocusSearch: scope.handleFocusSearch,
    onOpenSettings: () => settings.modal.open("general"),
    onOpenShortcuts: () => setShortcutsModalOpen(true),
    onRefreshLibrary: library.refreshLibraryItems,
    onRenameItem: () => {
      if (library.activeLibraryItem) skillDialogs.rename.request(library.activeLibraryItem.item);
    },
  });

  return (
    <div className="skillful-shell">
      <div className="app-layout">
        <AppSidebar
          collections={sidebarCollections}
          tools={sidebarTools}
          selectedScope={activeScope}
          refreshing={library.refreshingSkills}
          onSelectScope={setActiveScope}
          onRefresh={library.refreshLibraryItems}
          onCreateCollection={collectionDialogs.create.open}
          onImportCollection={collectionDialogs.import.open}
          onRenameCollection={collectionDialogs.rename.request}
          onDeleteCollection={collectionDialogs.delete.request}
          onExportCollection={handleExportCollection}
          onOpenSettings={settings.modal.open}
          updateAvailable={updater.updateAvailable}
          updateReady={updater.updateReady}
          onOpenUpdates={handleOpenUpdates}
          onOpenShortcuts={handleOpenShortcuts}
        />

        <main className="main-column">
          <div
            ref={containerRef}
            className={isDragging ? "workspace-frame resizing" : "workspace-frame"}
            style={
              largeLayout
                ? {
                    gridTemplateColumns: `${listWidth}px 8px minmax(0, 1fr)`,
                  }
                : undefined
            }
          >
            <LibraryItemListPane
              libraryItems={shownSkills}
              selectedId={library.activeLibraryItemId}
              query={query}
              title={activeTool?.title ?? activeCollection?.title ?? t("library.allItems")}
              focusSearchToken={scope.focusSearchToken}
              kindFilter={kindFilter}
              onKindFilterChange={setKindFilter}
              permissions={listPermissions}
              showItemCollections={showItemCollections}
              collectionTitleById={collectionTitleById}
              onCreateSkill={skillDialogs.create.open}
              onRenameSkill={skillDialogs.rename.request}
              onMoveSkill={skillDialogs.move.request}
              onRevealSkill={handleRevealSkill}
              onDeleteSkill={skillDialogs.delete.request}
              onQueryChange={setQuery}
              onSelectSkill={library.requestSkillChange}
              onFocusEditor={handleFocusEditor}
            />
            {largeLayout ? (
              <button
                type="button"
                className="pane-separator"
                aria-label={t("layout.resizeSkillList")}
                {...separatorProps}
              >
                <span className="pane-separator-handle" />
              </button>
            ) : null}
            <LibraryItemDetails
              document={library.activeLibraryItem}
              collectionTitle={activeDocumentCollectionTitle}
              activeRelativePath={library.activeFilePath}
              onActiveRelativePathChange={library.setActiveFilePath}
              drafts={library.activeDrafts}
              onDraftChange={library.updateDraft}
              viewModeIntent={library.viewModeIntent}
              saveState={detailsSaveState}
              tooling={detailsTooling}
              fileActions={detailsFileActions}
              editorRef={editorRef}
            />
          </div>
        </main>
      </div>

      <SettingsModal
        opened={settings.modal.opened}
        activeTab={settings.modal.activeTab}
        general={{
          defaultEditorMode: settings.general.defaultEditorMode,
          onDefaultEditorModeChange: settings.general.setDefaultEditorMode,
          language: settings.general.language,
          onLanguageChange: handleSettingsLanguageChange,
          suppressSuccessNotifications: settings.general.suppressSuccessNotifications,
          onSuppressSuccessNotificationsChange: settings.general.setSuppressSuccessNotifications,
          minimizeToTrayOnClose: settings.general.minimizeToTrayOnClose,
          onMinimizeToTrayOnCloseChange: settings.general.setMinimizeToTrayOnClose,
        }}
        library={{
          scanRoots: settings.library.rows,
          defaultScanRoot: settings.appSettings?.defaultScanRoot ?? "",
          validationById: settings.library.validation.byId,
          onScanRootChange: settings.library.updateRow,
          onAddScanRoot: settings.library.addRow,
          onRemoveScanRoot: settings.library.removeRow,
          onRestoreScanRoot: settings.library.restoreRow,
        }}
        tools={{
          tools: settings.tools.rows,
          validationById: settings.tools.validation.byId,
          availablePresets: settings.tools.availablePresets,
          onToolChange: settings.tools.updateRow,
          onPickInstallFolder: settings.tools.pickInstallFolder,
          onAddTool: settings.tools.addRow,
          onAddPreset: settings.tools.addPreset,
          onRemoveTool: settings.tools.removeRow,
          onRestoreTool: settings.tools.restoreRow,
          activeRowId: settings.tools.activeRowId,
          onActiveRowChange: settings.tools.setActiveRowId,
        }}
        backup={{
          config: settings.backup.config,
          issue: settings.backup.issue,
          errorMessage: settings.backup.errorMessage,
          onConfigChange: settings.backup.updateConfig,
          onPickRepository: () => void settings.backup.pickRepository(),
        }}
        updates={{
          updateState: updater.updateState,
          loading: updater.loading,
          checking: updater.checking,
          downloading: updater.downloading,
          applying: updater.applying,
          errorMessage: updater.errorMessage,
          onCheckForUpdates: () => void updater.checkForUpdates(),
          onDownloadUpdate: () => void updater.downloadUpdate(),
          onApplyUpdate: () => void updater.applyUpdate(),
        }}
        footer={{
          hasChanges: settings.modal.hasChanges,
          saving: settings.modal.saving,
          errorMessage: settings.modal.errorMessage,
          syncAfterSave: syncSettingsAfterSave,
          canTestBackup:
            settings.backup.config.enabled &&
            !settings.backup.hasUnsavedChanges &&
            !settings.modal.hasValidationErrors,
          testingBackup: settings.backup.initializing,
          backupTestSucceeded: settings.backup.initializeSucceeded,
          onClose: settings.modal.close,
          onSave: () =>
            void settings.modal.save({
              activeLibraryItemId: library.activeLibraryItemId,
              backupAfterSave: syncSettingsAfterSave,
              toolMappings: settings.appSettings?.toolMappings ?? [],
              reloadSkills: library.loadSkillList,
              reloadToolStatuses: skillTools.loadToolStatuses,
            }),
          onTestBackup: () => void settings.backup.initialize(),
        }}
        onTabChange={settings.modal.setActiveTab}
        dirtyTabs={settings.modal.dirtyTabs}
      />

      <CreateCollectionModal
        opened={collectionDialogs.create.opened}
        saving={collectionDialogs.create.saving}
        errorMessage={collectionDialogs.create.errorMessage}
        onClose={collectionDialogs.create.close}
        onCreate={collectionDialogs.create.onCreate}
      />

      <ImportCollectionModal
        opened={collectionDialogs.import.opened}
        saving={collectionDialogs.import.saving}
        errorMessage={collectionDialogs.import.errorMessage}
        draft={collectionDialogs.import.draft}
        onClose={collectionDialogs.import.close}
        onClearError={collectionDialogs.import.clearError}
        onPickFolder={collectionDialogs.import.onPickFolder}
        onPickArchive={collectionDialogs.import.onPickArchive}
        onImportFolder={collectionDialogs.import.onImportFolder}
        onImportArchive={collectionDialogs.import.onImportArchive}
        onImportGitHub={collectionDialogs.import.onImportGitHub}
      />

      <RenameCollectionModal
        opened={Boolean(collectionDialogs.rename.target)}
        currentName={collectionDialogs.rename.target?.title ?? ""}
        saving={library.status === "loading"}
        errorMessage={collectionDialogs.rename.errorMessage}
        onClose={collectionDialogs.rename.close}
        onRename={collectionDialogs.rename.onRename}
      />

      <CreateLibraryItemModal
        opened={skillDialogs.create.opened}
        saving={skillDialogs.create.saving}
        errorMessage={skillDialogs.create.errorMessage}
        collections={collections}
        defaultCollectionId={skillDialogs.create.defaultCollectionId}
        onClose={skillDialogs.create.close}
        onCreate={skillDialogs.create.onCreate}
      />

      <RenameLibraryItemModal
        opened={Boolean(skillDialogs.rename.target)}
        itemKind={skillDialogs.rename.target?.kind ?? activeItemKind}
        currentName={skillDialogs.rename.target?.title ?? ""}
        saving={library.status === "saving"}
        errorMessage={skillDialogs.rename.errorMessage}
        onClose={skillDialogs.rename.close}
        onRename={skillDialogs.rename.onRename}
      />

      <MoveLibraryItemModal
        opened={Boolean(skillDialogs.move.target)}
        itemKind={skillDialogs.move.target?.kind ?? activeItemKind}
        itemTitle={skillDialogs.move.target?.title ?? ""}
        currentCollectionId={skillDialogs.move.target?.collectionId ?? ""}
        collections={collections}
        saving={skillDialogs.move.moving}
        errorMessage={skillDialogs.move.errorMessage}
        onClose={skillDialogs.move.close}
        onMove={skillDialogs.move.onMove}
      />

      <DeleteCollectionDialog
        opened={Boolean(collectionDialogs.delete.target)}
        collectionTitle={collectionDialogs.delete.target?.title ?? ""}
        deleting={collectionDialogs.delete.deleting}
        errorMessage={collectionDialogs.delete.errorMessage}
        onCancel={collectionDialogs.delete.close}
        onDelete={() => void collectionDialogs.delete.onDelete()}
      />

      <DeleteLibraryItemDialog
        opened={Boolean(skillDialogs.delete.target)}
        itemKind={skillDialogs.delete.target?.kind ?? "skill"}
        libraryItemTitle={skillDialogs.delete.target?.title ?? ""}
        deleting={skillDialogs.delete.deleting}
        errorMessage={skillDialogs.delete.errorMessage}
        onCancel={skillDialogs.delete.close}
        onDelete={() => void skillDialogs.delete.onDelete()}
      />

      <KeyboardShortcutsModal
        opened={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />

      <MissingToolParentDialog
        confirming={skillTools.missingParentDialog.confirming}
        request={skillTools.missingParentDialog.request}
        onCancel={skillTools.missingParentDialog.onCancel}
        onConfirm={() => void skillTools.missingParentDialog.onConfirm()}
      />

      <UnsavedChangesDialog
        opened={library.unsavedDialogOpen}
        onSave={() => void library.confirmSaveAndNavigate()}
        onDiscard={library.discardAndNavigate}
        onCancel={library.cancelNavigation}
      />

      <OnboardingTour
        appSettings={settings.appSettings}
        blocked={onboardingBlocked}
        setAppSettings={settings.setAppSettings}
      />
    </div>
  );
}

export default App;
