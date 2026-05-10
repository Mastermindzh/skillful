import type { LibraryItemKind } from "../../../shared/types";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import { useAppTranslation } from "../../i18n/i18n";

type DeleteLibraryItemDialogProps = {
  opened: boolean;
  itemKind: LibraryItemKind;
  libraryItemTitle: string;
  deleting: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onDelete: () => void;
};

export function DeleteLibraryItemDialog({
  opened,
  itemKind,
  libraryItemTitle,
  deleting,
  errorMessage,
  onCancel,
  onDelete,
}: DeleteLibraryItemDialogProps) {
  const { t } = useAppTranslation();
  const label = t(itemKind === "agent" ? "item.kind.agent" : "item.kind.skill").toLowerCase();

  return (
    <ConfirmDialog
      opened={opened}
      title={t("item.delete.title", { kind: label })}
      description={t("item.delete.description", { name: libraryItemTitle, kind: label })}
      confirming={deleting}
      errorMessage={errorMessage}
      confirmLabel={t("common.delete")}
      onCancel={onCancel}
      onConfirm={onDelete}
    />
  );
}
