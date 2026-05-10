import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useState } from "react";
import type { LibraryItemCollectionSummary } from "../../../shared/types";
import { TextEntryDialog } from "../../components/dialogs/TextEntryDialog";
import { useAppTranslation } from "../../i18n/i18n";

type RenameCollectionModalProps = {
  opened: boolean;
  currentName: string;
  saving: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onRename: (name: string) => Promise<LibraryItemCollectionSummary | null>;
};

export function RenameCollectionModal({
  opened,
  currentName,
  saving,
  errorMessage,
  onClose,
  onRename,
}: RenameCollectionModalProps) {
  const { t } = useAppTranslation();
  const [name, setName] = useState(currentName);

  useEffect(() => {
    if (!opened) return;
    setName(currentName);
  }, [currentName, opened]);

  const handleSubmit: ComponentPropsWithoutRef<"form">["onSubmit"] = async (event) => {
    event.preventDefault();
    const renamed = await onRename(name);
    if (renamed) {
      setName("");
    }
  };

  return (
    <TextEntryDialog
      opened={opened}
      title={t("collection.rename.title")}
      description={t("collection.rename.description")}
      label={t("collection.name")}
      placeholder={t("collection.name.placeholder")}
      value={name}
      saving={saving}
      errorMessage={errorMessage}
      submitLabel={t("collection.rename.submit")}
      onClose={onClose}
      onValueChange={setName}
      onSubmit={handleSubmit}
    />
  );
}
