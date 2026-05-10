import { Button, FileButton, Text } from "@mantine/core";
import { Upload } from "lucide-react";
import type { LibraryItemAdditionalFile } from "../../../shared/types";
import { EmptyState } from "../../components/EmptyState";
import { useAppTranslation } from "../../i18n/i18n";
import { visibleAdditionalFileLabel } from "../skills/libraryItems";
import { AdditionalFileRow } from "./AdditionalFileRow";

type AdditionalFilesPanelState = {
  saving: boolean;
  uploadError: string | null;
  actionPath: string | null;
};

type AdditionalFilesPanelActions = {
  onUploadFiles: (files: File[] | null) => Promise<void>;
  onRenameFile: (file: LibraryItemAdditionalFile, label: string) => void;
  onDeleteFile: (file: LibraryItemAdditionalFile, label: string) => void;
  onRevealFile: (absolutePath: string) => Promise<void>;
  onOpenFile: (absolutePath: string) => Promise<void>;
};

type AdditionalFilesPanelProps = {
  files: LibraryItemAdditionalFile[];
  state: AdditionalFilesPanelState;
  actions: AdditionalFilesPanelActions;
};

export function AdditionalFilesPanel({ files, state, actions }: AdditionalFilesPanelProps) {
  const { t } = useAppTranslation();
  return (
    <>
      <div className="additional-files-toolbar">
        <FileButton onChange={(nextFiles) => void actions.onUploadFiles(nextFiles)} multiple>
          {(props) => (
            <Button
              {...props}
              variant="light"
              leftSection={<Upload size={15} />}
              disabled={state.saving}
            >
              {t("additionalFiles.upload")}
            </Button>
          )}
        </FileButton>
      </div>
      {state.uploadError ? (
        <Text size="sm" c="red.7">
          {state.uploadError}
        </Text>
      ) : null}
      {files.length > 0 ? (
        <div className="additional-files-list">
          {files.map((file) => {
            const label = visibleAdditionalFileLabel(file);

            return (
              <AdditionalFileRow
                key={file.relativePath}
                relativePath={file.relativePath}
                absolutePath={file.absolutePath}
                label={label}
                actionPath={state.actionPath}
                onRename={() => actions.onRenameFile(file, label)}
                onReveal={() => actions.onRevealFile(file.absolutePath)}
                onOpen={() => actions.onOpenFile(file.absolutePath)}
                onDelete={() => actions.onDeleteFile(file, label)}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={t("additionalFiles.empty.title")}
          message={t("additionalFiles.empty.message")}
        />
      )}
    </>
  );
}
