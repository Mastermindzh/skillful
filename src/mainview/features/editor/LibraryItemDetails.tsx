import { Tabs } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { frontmatterMetadataWarningsForFiles } from "../../../shared/frontmatter";
import type { EditorViewMode } from "../../../shared/types";
import { EmptyState } from "../../components/EmptyState";
import { useAppTranslation } from "../../i18n/i18n";
import { countToolStatuses } from "../tools/status";
import { ToolStatusPanel } from "../tools/ToolStatusPanel";
import { AdditionalFilesPanel } from "./AdditionalFilesPanel";
import { CreateLibraryItemFileModal } from "./CreateLibraryItemFileModal";
import { ADDITIONAL_FILES_TAB } from "./constants";
import { DeleteLibraryItemFileDialog } from "./DeleteLibraryItemFileDialog";
import { LibraryItemDetailsHeader } from "./LibraryItemDetailsHeader";
import { LibraryItemFooter } from "./LibraryItemFooter";
import { LibraryItemTabsBar } from "./LibraryItemTabsBar";
import { MarkdownPreview } from "./MarkdownPreview";
import { MetadataWarningPanel } from "./MetadataWarningPanel";
import { RenameLibraryItemFileModal } from "./RenameLibraryItemFileModal";
import type { LibraryItemDetailsProps } from "./types";
import { useLibraryItemFileActions } from "./useLibraryItemFileActions";

const LibraryItemCodeEditor = lazy(async () => {
  const module = await import("./LibraryItemCodeEditor");
  return { default: module.LibraryItemCodeEditor };
});

export function LibraryItemDetails({
  document,
  collectionTitle,
  activeRelativePath,
  onActiveRelativePathChange,
  drafts,
  onDraftChange,
  viewModeIntent,
  saveState,
  tooling,
  fileActions,
  editorRef,
}: LibraryItemDetailsProps) {
  const { t } = useAppTranslation();
  const compactActions = useMediaQuery("(max-width: 1280px)");
  const [viewMode, setViewMode] = useState<EditorViewMode>("preview");
  const activeFile =
    document?.files.find((file) => file.relativePath === activeRelativePath) ??
    (activeRelativePath ? null : (document?.files[0] ?? null));
  const dirtyFiles = useMemo(
    () =>
      document?.files.filter(
        (file) => (drafts[file.relativePath] ?? file.content) !== file.content
      ) ?? [],
    [document, drafts]
  );
  const dirtyRelativePaths = useMemo(
    () => new Set(dirtyFiles.map((file) => file.relativePath)),
    [dirtyFiles]
  );
  const metadataWarnings = useMemo(
    () =>
      document
        ? frontmatterMetadataWarningsForFiles(
            document.item.entryPath,
            document.files.map((file) => ({
              relativePath: file.relativePath,
              content: drafts[file.relativePath] ?? file.content,
              isEntry: file.isEntry,
            }))
          )
        : [],
    [document, drafts]
  );
  const toolStatusCounts = useMemo(
    () => countToolStatuses(tooling.toolStatuses),
    [tooling.toolStatuses]
  );
  const fileUi = useLibraryItemFileActions({
    activeFile,
    documentId: document?.item.id ?? null,
    fileActions,
    onActiveRelativePathChange,
    saving: saveState.saving,
  });

  useEffect(() => {
    const { mode, token } = viewModeIntent;
    void token;
    setViewMode(mode);
  }, [viewModeIntent]);

  return (
    <section className="split-pane detail-pane">
      {document ? (
        <>
          <div className="detail-pane-layout">
            <div className="detail-pane-main">
              <LibraryItemDetailsHeader
                libraryItem={document.item}
                collectionTitle={collectionTitle}
                activeFile={activeFile}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                compactActions={compactActions}
                saving={saveState.saving}
                canSaveCurrent={saveState.canSaveCurrent}
                canSaveAll={saveState.canSaveAll}
                onSaveCurrent={saveState.onSaveCurrent}
                onSaveAll={saveState.onSaveAll}
                actionsSlot={
                  tooling.tools.length > 0 ? (
                    <ToolStatusPanel
                      statuses={tooling.toolStatuses}
                      activeActionToolId={tooling.activeToolActionId}
                      onRefresh={tooling.onRefreshToolStatuses}
                      onInstall={tooling.onInstallTool}
                      onRemove={tooling.onRemoveTool}
                      onRepair={tooling.onRepairTool}
                    />
                  ) : null
                }
              />

              <MetadataWarningPanel warnings={metadataWarnings} />

              <div className="detail-pane-content">
                <Tabs
                  value={activeRelativePath}
                  onChange={onActiveRelativePathChange}
                  className="editor-tabs"
                >
                  <LibraryItemTabsBar
                    files={document.files}
                    additionalFiles={document.additionalFiles}
                    dirtyRelativePaths={dirtyRelativePaths}
                    currentFileActions={fileUi.currentFileActions}
                  />

                  {activeFile ? (
                    <Tabs.Panel
                      key={activeFile.relativePath}
                      value={activeFile.relativePath}
                      pt="sm"
                      className="editor-panel"
                    >
                      <div className="editor-panel-body">
                        {viewMode === "preview" ? (
                          <MarkdownPreview
                            value={drafts[activeFile.relativePath] ?? activeFile.content}
                          />
                        ) : (
                          <Suspense
                            fallback={
                              <div className="editor-field editor-loading" aria-live="polite">
                                {t("details.loadingEditor")}
                              </div>
                            }
                          >
                            <LibraryItemCodeEditor
                              documentId={document.item.id}
                              filePath={activeFile.relativePath}
                              value={drafts[activeFile.relativePath] ?? activeFile.content}
                              onChange={(value) => onDraftChange(activeFile.relativePath, value)}
                              onSave={saveState.onSaveCurrent}
                              editorRef={editorRef}
                            />
                          </Suspense>
                        )}
                      </div>
                    </Tabs.Panel>
                  ) : null}
                  <Tabs.Panel
                    value={ADDITIONAL_FILES_TAB}
                    pt="sm"
                    className="editor-panel additional-files-panel"
                  >
                    <AdditionalFilesPanel
                      files={document.additionalFiles}
                      state={fileUi.additionalFilesState}
                      actions={fileUi.additionalFilesActions}
                    />
                  </Tabs.Panel>
                </Tabs>
              </div>
            </div>
            {activeFile ? (
              <LibraryItemFooter
                absolutePath={activeFile.absolutePath}
                dirtyCount={dirtyFiles.length}
                installedToolCount={toolStatusCounts.installed}
                repairToolCount={toolStatusCounts.broken}
                blockedToolCount={toolStatusCounts.conflict}
                onRevealPath={(absolutePath) => {
                  void fileActions.onRevealItemFolder(absolutePath);
                }}
              />
            ) : null}
          </div>
          <CreateLibraryItemFileModal
            opened={fileUi.createFileDialog.opened}
            saving={saveState.saving}
            errorMessage={fileUi.createFileDialog.errorMessage}
            onClose={fileUi.createFileDialog.onClose}
            onCreate={fileUi.createFileDialog.onCreate}
          />
          <RenameLibraryItemFileModal
            opened={fileUi.renameFileDialog.opened}
            title={t("file.rename.title")}
            description={t("file.rename.description")}
            label={fileUi.renameFileDialog.label}
            saving={saveState.saving}
            errorMessage={fileUi.renameFileDialog.errorMessage}
            onClose={fileUi.renameFileDialog.onClose}
            onRename={fileUi.renameFileDialog.onRename}
          />
          <DeleteLibraryItemFileDialog
            opened={fileUi.deleteFileDialog.opened}
            fileLabel={fileUi.deleteFileDialog.fileLabel}
            deleting={saveState.saving}
            errorMessage={fileUi.deleteFileDialog.errorMessage}
            onCancel={fileUi.deleteFileDialog.onCancel}
            onDelete={() => void fileUi.deleteFileDialog.onDelete()}
          />
        </>
      ) : (
        <EmptyState
          title={t("details.noSelection.title")}
          message={t("details.noSelection.message")}
        />
      )}
    </section>
  );
}
