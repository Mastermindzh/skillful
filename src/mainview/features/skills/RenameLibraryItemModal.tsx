import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useState } from "react";
import type { LibraryItemDocument, LibraryItemKind } from "../../../shared/types";
import { TextEntryDialog } from "../../components/dialogs/TextEntryDialog";
import { useAppTranslation } from "../../i18n/i18n";

type RenameLibraryItemModalProps = {
  opened: boolean;
  itemKind: LibraryItemKind;
  currentName: string;
  saving: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onRename: (name: string) => Promise<LibraryItemDocument | null>;
};

export function RenameLibraryItemModal({
  opened,
  itemKind,
  currentName,
  saving,
  errorMessage,
  onClose,
  onRename,
}: RenameLibraryItemModalProps) {
  const { t } = useAppTranslation();
  const [name, setName] = useState(currentName);
  const kindTitle = t(itemKind === "agent" ? "item.kind.agent" : "item.kind.skill");
  const label = kindTitle.toLowerCase();

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
      title={t("item.rename.title", { kind: label })}
      description={t("item.rename.description", { kind: label })}
      label={t("item.name", { kind: kindTitle })}
      placeholder={itemKind === "agent" ? "Code reviewer" : t("item.name.skillPlaceholder")}
      value={name}
      saving={saving}
      errorMessage={errorMessage}
      submitLabel={t("item.rename.submit", { kind: label })}
      onClose={onClose}
      onValueChange={setName}
      onSubmit={handleSubmit}
    />
  );
}
