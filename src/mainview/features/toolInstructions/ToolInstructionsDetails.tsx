import {
  ActionIcon,
  Alert,
  Group,
  Loader,
  Scroller,
  Tabs,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { Plus, Save, X } from "lucide-react";
import type { RefObject } from "react";
import { UnsavedChangesDialog } from "../../components/UnsavedChangesDialog";
import { useAppTranslation } from "../../i18n/i18n";
import { CreateMarkdownFileModal } from "../editor/CreateMarkdownFileModal";
import { EditorFooter } from "../editor/EditorFooter";
import { FileContentPanel } from "../editor/FileContentPanel";
import { FileTab } from "../editor/FileTab";
import type { EditorHandle } from "../editor/types";
import { ViewModeToggle } from "../editor/ViewModeToggle";
import { InstructionsChangedDialog } from "./InstructionsChangedDialog";
import type { ToolInstructionsState } from "./useToolInstructions";

type ToolInstructionsDetailsProps = {
  instructions: ToolInstructionsState;
  editorRef: RefObject<EditorHandle | null>;
  onRevealPath: (absolutePath: string) => void;
};

/** Details pane for a tool's own instructions files, edited in place where the tool reads them. */
export function ToolInstructionsDetails({
  instructions,
  editorRef,
  onRevealPath,
}: ToolInstructionsDetailsProps) {
  const { t } = useAppTranslation();
  const { document, activeFile, drafts, viewMode, dirtyPaths } = instructions;
  const mainFile = document?.files.find((file) => file.role === "main") ?? null;
  const overrideFile = document?.files.find((file) => file.role === "override") ?? null;

  return (
    <section className="split-pane detail-pane" aria-busy={instructions.loading}>
      {document ? (
        <div className="detail-pane-layout">
          <div className="detail-pane-main">
            <div className="editor-toolbar">
              <div className="editor-toolbar-copy">
                <Title order={3}>{t("instructions.title", { tool: document.toolName })}</Title>
                <Text mt="xs" size="sm" c="dimmed" className="editor-toolbar-description">
                  {t("instructions.description", { tool: document.toolName })}
                </Text>
              </div>
              <Group gap="xs" wrap="nowrap" className="editor-actions">
                {activeFile ? (
                  <ViewModeToggle viewMode={viewMode} onViewModeChange={instructions.setViewMode} />
                ) : null}
                <ActionIcon
                  variant="filled"
                  size="lg"
                  loading={instructions.saving}
                  disabled={!instructions.hasUnsavedChanges}
                  onClick={() => void instructions.saveAll()}
                  aria-label={t("details.saveAll")}
                  title={t("details.saveAll")}
                >
                  <Save size={16} />
                </ActionIcon>
                <Tooltip label={t("instructions.close")} withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="lg"
                    aria-label={t("instructions.close")}
                    onClick={() => instructions.close()}
                  >
                    <X size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </div>

            {overrideFile && mainFile ? (
              <Alert color="yellow" variant="light" mt="xs" role="status">
                {t("instructions.overrideActive", {
                  override: overrideFile.relativePath,
                  main: mainFile.relativePath,
                })}
              </Alert>
            ) : null}

            {instructions.error ? (
              <Alert color="red" variant="light" mt="xs" role="alert">
                {instructions.error}
              </Alert>
            ) : null}

            <div className="detail-pane-content">
              <Tabs
                value={instructions.activePath}
                onChange={instructions.setActivePath}
                className="editor-tabs"
              >
                <div className="editor-tabs-header">
                  <Tabs.List>
                    <Scroller className="file-tabs-scroller">
                      {document.files.map((file) => (
                        <FileTab
                          key={file.relativePath}
                          value={file.relativePath}
                          label={file.relativePath}
                          dirty={dirtyPaths.has(file.relativePath)}
                        />
                      ))}
                    </Scroller>
                  </Tabs.List>
                  {document.rulesDirectory ? (
                    <Tooltip label={t("instructions.rule.create.title")} withArrow>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        aria-label={t("instructions.rule.create.title")}
                        onClick={instructions.createRuleDialog.open}
                      >
                        <Plus size={15} />
                      </ActionIcon>
                    </Tooltip>
                  ) : null}
                </div>

                {activeFile ? (
                  <FileContentPanel
                    key={activeFile.relativePath}
                    documentId={`tool-instructions:${document.toolId}`}
                    filePath={activeFile.relativePath}
                    value={drafts[activeFile.relativePath] ?? activeFile.content}
                    viewMode={viewMode}
                    onChange={(value) => instructions.updateDraft(activeFile.relativePath, value)}
                    onSave={() => void instructions.saveCurrent()}
                    editorRef={editorRef}
                    emptyPreviewMessage={t("instructions.empty")}
                  />
                ) : null}
              </Tabs>
            </div>
          </div>
          {activeFile ? (
            <EditorFooter
              absolutePath={activeFile.absolutePath}
              dirtyCount={dirtyPaths.size}
              onRevealPath={(path) => onRevealPath(activeFile.exists ? path : document.directory)}
            >
              {activeFile.exists ? null : (
                <Text size="xs" c="dimmed">
                  {t("instructions.notCreated")}
                </Text>
              )}
            </EditorFooter>
          ) : null}
        </div>
      ) : (
        <Group justify="center" p="xl">
          <Loader size="sm" aria-label={t("instructions.loading")} />
        </Group>
      )}

      <CreateMarkdownFileModal
        opened={instructions.createRuleDialog.opened}
        saving={instructions.saving}
        errorMessage={instructions.createRuleDialog.errorMessage}
        title={t("instructions.rule.create.title")}
        description={t("instructions.rule.create.description")}
        placeholder={t("instructions.rule.create.placeholder")}
        onClose={instructions.createRuleDialog.onClose}
        onCreate={instructions.createRuleDialog.onCreate}
      />
      <InstructionsChangedDialog
        opened={instructions.conflictDialog.opened}
        paths={instructions.conflictDialog.paths}
        saving={instructions.saving}
        onOverwrite={instructions.conflictDialog.onOverwrite}
        onReload={instructions.conflictDialog.onReload}
        onCancel={instructions.conflictDialog.onCancel}
      />
      <UnsavedChangesDialog
        opened={instructions.unsavedDialog.opened}
        onSave={() => void instructions.unsavedDialog.onSave()}
        onDiscard={instructions.unsavedDialog.onDiscard}
        onCancel={instructions.unsavedDialog.onCancel}
      />
    </section>
  );
}
