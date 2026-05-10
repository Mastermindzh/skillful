import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import { useAppTranslation } from "../../i18n/i18n";

type DeleteSkillFileDialogProps = {
  opened: boolean;
  fileLabel: string;
  deleting: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onDelete: () => void;
};

export function DeleteLibraryItemFileDialog({
  opened,
  fileLabel,
  deleting,
  errorMessage,
  onCancel,
  onDelete,
}: DeleteSkillFileDialogProps) {
  const { t } = useAppTranslation();
  return (
    <ConfirmDialog
      opened={opened}
      title={t("file.delete.title")}
      description={t("file.delete.description", { name: fileLabel })}
      confirming={deleting}
      errorMessage={errorMessage}
      confirmLabel={t("common.delete")}
      onCancel={onCancel}
      onConfirm={onDelete}
    />
  );
}
