import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import { useAppTranslation } from "../../i18n/i18n";

type DeleteCollectionDialogProps = {
  opened: boolean;
  collectionTitle: string;
  deleting: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onDelete: () => void;
};

export function DeleteCollectionDialog({
  opened,
  collectionTitle,
  deleting,
  errorMessage,
  onCancel,
  onDelete,
}: DeleteCollectionDialogProps) {
  const { t } = useAppTranslation();
  return (
    <ConfirmDialog
      opened={opened}
      title={t("collection.delete.title")}
      description={t("collection.delete.description", { name: collectionTitle })}
      confirming={deleting}
      errorMessage={errorMessage}
      confirmLabel={t("common.delete")}
      onCancel={onCancel}
      onConfirm={onDelete}
    />
  );
}
