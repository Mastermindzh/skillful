import { appRpc } from "@mainview-bridge";
import { useMediaQuery } from "@mantine/hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LibraryItemSummary } from "../shared/types";
import { AppDialogs, appDialogOpen } from "./AppDialogs";
import { LibraryItemDetails } from "./features/editor/LibraryItemDetails";
import type {
  EditorHandle,
  LibraryItemDetailsFileActions,
  LibraryItemDetailsSaveState,
  LibraryItemDetailsTooling,
} from "./features/editor/types";
import { useLibraryView } from "./features/layout/useLibraryView";
import { useSplitPane } from "./features/layout/useSplitPane";
import { AppSidebar } from "./features/navigation/AppSidebar";
import { useCollectionDialogs } from "./features/navigation/useCollectionDialogs";
import { useAppNotifications } from "./features/notifications/useAppNotifications";
import { OnboardingTour } from "./features/onboarding/OnboardingTour";
import { AppSettingsModal } from "./features/settings/components/AppSettingsModal";
import { useAppLanguage } from "./features/settings/state/useAppLanguage";
import { useSettingsActions } from "./features/settings/state/useSettingsActions";
import { useSettingsState } from "./features/settings/state/useSettingsState";
import { useUpdaterState } from "./features/settings/state/useUpdaterState";
import { useAppShortcuts } from "./features/shortcuts/useAppShortcuts";
import { LibraryItemListPane } from "./features/skills/LibraryItemListPane";
import { useLibraryItemDialogs } from "./features/skills/useLibraryItemDialogs";
import { useLibraryItemLibrary } from "./features/skills/useLibraryItemLibrary";
import { ToolInstructionsDetails } from "./features/toolInstructions/ToolInstructionsDetails";
import { useToolInstructions } from "./features/toolInstructions/useToolInstructions";
import { useToolInstructionsEntryPoints } from "./features/toolInstructions/useToolInstructionsEntryPoints";
import { useLibraryItemTools } from "./features/tools/useLibraryItemTools";
import { useAppTranslation } from "./i18n/i18n";

function App() {
  const { t } = useAppTranslation();
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const editorRef = useRef<EditorHandle | null>(null);
  const largeLayout = useMediaQuery("(min-width: 901px)");
  const { containerRef, isDragging, listWidth, separatorProps } = useSplitPane(largeLayout);

  const settings = useSettingsState();
  const defaultEditorMode = settings.appSettings?.defaultEditorMode ?? "preview";
  const library = useLibraryItemLibrary(defaultEditorMode);
  const updater = useUpdaterState();
  const toolInstructions = useToolInstructions(defaultEditorMode);
  const skillTools = useLibraryItemTools({
    activeLibraryItem: library.activeLibraryItem,
    setAppSettings: settings.setAppSettings,
    setError: library.setError,
  });
  const settingsActions = useSettingsActions(settings, {
    activeLibraryItemId: library.activeLibraryItemId,
    reloadItems: library.loadSkillList,
    reloadItemsAfterRestore: library.reloadLibraryAfterRestore,
    reloadToolStatuses: skillTools.loadToolStatuses,
  });

  const { loadSettings } = settings;
  const { open: openSettingsModal } = settings.modal;
  const { runToolAction } = skillTools;

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);
  useAppLanguage(settings);
  useAppNotifications(settings.appSettings?.gitLibraries);

  const view = useLibraryView({
    libraryItems: library.libraryItemList,
    collectionList: library.collectionList,
    appSettings: settings.appSettings,
    activeItemId: library.activeLibraryItemId,
    clearActiveItem: library.clearActiveSkill,
    setActiveItemId: library.setActiveSkillId,
  });
  const {
    scope,
    activeCollection,
    activeTool,
    activeCollectionReadOnly,
    writableCollections,
    collectionTitleById,
    gitLibraryById,
  } = view;
  const { query, setQuery, activeScope, setActiveScope, kindFilter, setKindFilter } = scope;
  const activeDocumentCollectionTitle = library.activeLibraryItem
    ? (collectionTitleById.get(library.activeLibraryItem.item.collectionId) ?? null)
    : null;

  const collectionDialogs = useCollectionDialogs({
    library,
    activeScope,
    setActiveScope,
    setQuery,
  });
  const { onExport: exportCollection } = collectionDialogs;
  const skillDialogs = useLibraryItemDialogs({
    library,
    collections: view.collections,
    activeCollectionId: activeCollection?.id ?? null,
    setActiveScope,
    setQuery,
    setKindFilter,
  });
  const instructionsEntry = useToolInstructionsEntryPoints({
    instructions: toolInstructions,
    tools: settings.appSettings?.tools,
    activeToolId: activeTool?.id ?? null,
    requestItemChange: library.requestSkillChange,
    createItem: skillDialogs.create.onCreate,
    settingsHaveChanges: settings.modal.hasChanges,
    saveSettings: settingsActions.save,
    closeSettings: settings.modal.close,
  });

  const handleFocusEditor = useCallback(() => editorRef.current?.focus(), []);
  const handleRevealSkill = useCallback((item: LibraryItemSummary) => {
    void appRpc.request.revealPath({ path: item.rootPath });
  }, []);
  const handleInstallTool = useCallback(
    (toolId: string) => void runToolAction(toolId, "install"),
    [runToolAction]
  );
  const handleRemoveTool = useCallback(
    (toolId: string) => void runToolAction(toolId, "remove"),
    [runToolAction]
  );
  const handleRepairTool = useCallback(
    (toolId: string) => void runToolAction(toolId, "repair"),
    [runToolAction]
  );
  const handleExportCollection = useCallback(
    (collection: { id: string; title: string }) => void exportCollection(collection),
    [exportCollection]
  );
  const handleOpenUpdates = useCallback(() => openSettingsModal("updates"), [openSettingsModal]);
  const handleOpenShortcuts = useCallback(() => setShortcutsModalOpen(true), []);

  const libraryItemSupportsTools = Boolean(library.activeLibraryItem);
  const activeItemReadOnly = useMemo(() => {
    const sourceLibraryId = library.activeLibraryItem?.item.sourceLibraryId;
    if (!sourceLibraryId) return false;
    return Boolean(gitLibraryById.get(sourceLibraryId)?.readOnly);
  }, [gitLibraryById, library.activeLibraryItem?.item.sourceLibraryId]);
  const canSaveCurrent =
    !activeItemReadOnly && library.currentFileHasChanges && Boolean(library.currentFile);
  const canSaveAll = !activeItemReadOnly && library.changedFiles.length > 0;
  const listPermissions = useMemo(
    () => ({
      canCreate: writableCollections.length > 0 && !activeCollectionReadOnly,
      canRename: Boolean(library.activeLibraryItem) && !activeItemReadOnly,
      canDelete: Boolean(library.activeLibraryItem) && !activeItemReadOnly,
      canReveal: Boolean(library.activeLibraryItem),
      canMove:
        writableCollections.length > 1 && Boolean(library.activeLibraryItem) && !activeItemReadOnly,
    }),
    [
      activeCollectionReadOnly,
      activeItemReadOnly,
      library.activeLibraryItem,
      writableCollections.length,
    ]
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
    appDialogOpen({
      library,
      collectionDialogs,
      itemDialogs: skillDialogs,
      shortcutsOpened: shortcutsModalOpen,
    }) ||
    settings.modal.opened ||
    toolInstructions.unsavedDialog.opened ||
    toolInstructions.conflictDialog.opened ||
    toolInstructions.createRuleDialog.opened;
  const onboardingBlocked =
    shortcutsDisabled ||
    skillTools.missingParentDialog.request !== null ||
    updater.applying ||
    updater.downloading;
  const isMac =
    settings.appSettings?.platform === "darwin" || navigator.platform.toLowerCase().includes("mac");

  useAppShortcuts({
    enabled: !shortcutsDisabled,
    canCreateItem: writableCollections.length > 0 && !activeCollectionReadOnly,
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
    <div className={isMac ? "skillful-shell platform-mac" : "skillful-shell"}>
      <div className="app-layout">
        <AppSidebar
          collections={view.sidebarCollections}
          tools={view.sidebarTools}
          selectedScope={activeScope}
          refreshing={library.refreshingSkills}
          onSelectScope={setActiveScope}
          onRefresh={library.refreshLibraryItems}
          gitLibraryCount={settings.appSettings?.gitLibraries.length ?? 0}
          syncingGitLibraries={settings.gitLibraries.syncingAll}
          onSyncGitLibraries={settings.gitLibraries.syncAll}
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
              libraryItems={view.shownItems}
              selectedId={library.activeLibraryItemId}
              query={query}
              title={activeTool?.title ?? activeCollection?.title ?? t("library.allItems")}
              focusSearchToken={scope.focusSearchToken}
              kindFilter={kindFilter}
              onKindFilterChange={setKindFilter}
              permissions={listPermissions}
              showItemCollections={view.showItemCollections}
              collectionTitleById={collectionTitleById}
              gitLibraryById={gitLibraryById}
              gitLibrarySyncedAt={settings.appSettings?.gitLibrarySyncedAt ?? {}}
              onCreateSkill={skillDialogs.create.open}
              onRenameSkill={skillDialogs.rename.request}
              onMoveSkill={skillDialogs.move.request}
              onRevealSkill={handleRevealSkill}
              onDeleteSkill={skillDialogs.delete.request}
              onQueryChange={setQuery}
              onSelectSkill={instructionsEntry.selectItem}
              instructionsAction={instructionsEntry.listHeaderAction}
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
            {toolInstructions.toolId ? (
              <ToolInstructionsDetails
                instructions={toolInstructions}
                editorRef={editorRef}
                onRevealPath={(path) => void appRpc.request.revealPath({ path })}
              />
            ) : (
              <LibraryItemDetails
                document={library.activeLibraryItem}
                collectionTitle={activeDocumentCollectionTitle}
                readOnly={activeItemReadOnly}
                activeRelativePath={library.activeFilePath}
                onActiveRelativePathChange={library.setActiveFilePath}
                drafts={library.activeDrafts}
                onDraftChange={library.updateDraft}
                viewMode={library.viewMode}
                onViewModeChange={library.setViewMode}
                saveState={detailsSaveState}
                tooling={detailsTooling}
                fileActions={detailsFileActions}
                editorRef={editorRef}
              />
            )}
          </div>
        </main>
      </div>

      <AppSettingsModal
        settings={settings}
        actions={settingsActions}
        updater={updater}
        onEditInstructions={instructionsEntry.fromSettings.request}
      />

      <AppDialogs
        library={library}
        collectionDialogs={collectionDialogs}
        itemDialogs={skillDialogs}
        writableCollections={writableCollections}
        onCreateItem={instructionsEntry.createItem}
        shortcuts={{ opened: shortcutsModalOpen, onClose: () => setShortcutsModalOpen(false) }}
        missingToolParent={skillTools.missingParentDialog}
        instructionsFromSettings={instructionsEntry.fromSettings.dialog}
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
