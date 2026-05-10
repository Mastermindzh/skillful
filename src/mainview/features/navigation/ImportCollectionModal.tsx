import { Modal, SegmentedControl, Stack, Text, TextInput } from "@mantine/core";
import type { GitHubImportDraft } from "../../../shared/githubImport";
import { DialogErrorMessage } from "../../components/dialogs/DialogErrorMessage";
import { DialogFooter } from "../../components/dialogs/DialogFooter";
import { useAppTranslation } from "../../i18n/i18n";
import { FileSourceImportFields, GitHubImportFields } from "./ImportCollectionFields";
import { useImportCollectionModalState } from "./useImportCollectionModalState";

type ImportCollectionModalProps = {
  opened: boolean;
  saving: boolean;
  errorMessage: string | null;
  draft: GitHubImportDraft | null;
  onClose: () => void;
  onClearError: () => void;
  onPickFolder: () => Promise<string | null>;
  onPickArchive: () => Promise<string | null>;
  onImportFolder: (input: { name: string; sourcePath: string }) => Promise<boolean>;
  onImportArchive: (input: { name: string; archivePath: string }) => Promise<boolean>;
  onImportGitHub: (input: {
    name: string;
    repo: string;
    ref?: string;
    path?: string;
  }) => Promise<boolean>;
};

export function ImportCollectionModal({
  opened,
  saving,
  errorMessage,
  draft,
  onClose,
  onClearError,
  onPickFolder,
  onPickArchive,
  onImportFolder,
  onImportArchive,
  onImportGitHub,
}: ImportCollectionModalProps) {
  const { t } = useAppTranslation();
  const state = useImportCollectionModalState({
    opened,
    draft,
    errorMessage,
    onClearError,
    onPickFolder,
    onPickArchive,
    onImportFolder,
    onImportArchive,
    onImportGitHub,
  });

  return (
    <Modal opened={opened} onClose={onClose} title={t("import.title")} centered>
      <form onSubmit={state.handleSubmit}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t("import.description")}
          </Text>

          <SegmentedControl
            className="import-collection-mode"
            aria-label={t("import.source")}
            value={state.mode}
            onChange={state.handleModeChange}
            data={[
              { label: t("import.mode.archive"), value: "archive" },
              { label: t("import.mode.folder"), value: "folder" },
              { label: t("import.mode.github"), value: "github" },
            ]}
          />

          {state.isGitHubMode ? (
            <GitHubImportFields
              repo={state.repo}
              ref={state.ref}
              path={state.gitPath}
              repoError={state.errors.repo}
              refError={state.errors.ref}
              pathError={state.errors.path}
              advancedOpen={state.advancedOpen}
              onToggleAdvanced={() => state.setAdvancedOpen((current) => !current)}
              onRepoChange={state.handleRepoChange}
              onRefChange={state.handleRefChange}
              onPathChange={state.handlePathChange}
            />
          ) : (
            <FileSourceImportFields
              label={
                state.mode === "archive" ? t("import.sourceArchive") : t("import.sourceFolder")
              }
              placeholder={
                state.mode === "archive"
                  ? t("import.archivePlaceholder")
                  : t("import.folderPlaceholder")
              }
              value={state.sourcePath}
              error={state.errors.sourcePath}
              pickAriaLabel={
                state.mode === "archive" ? t("import.chooseArchive") : t("import.chooseFolder")
              }
              mode={state.mode === "archive" ? "archive" : "folder"}
              sourceName={state.sourceName}
              onPickSource={() => void state.handlePickSource()}
            />
          )}

          <TextInput
            label={t("collection.name")}
            placeholder={t("import.collectionPlaceholder")}
            value={state.name}
            onChange={(event) => state.handleNameChange(event.currentTarget.value)}
            error={state.errors.name}
            data-autofocus
          />

          <DialogErrorMessage message={state.errors.form} />

          <DialogFooter
            confirmType="submit"
            confirmLabel={t("import.submit")}
            confirmLoading={saving}
            confirmDisabled={!state.canImport}
          />
        </Stack>
      </form>
    </Modal>
  );
}
