import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useState } from "react";
import type { LibraryItemDocument } from "../../../shared/types";
import { TextEntryDialog } from "../../components/dialogs/TextEntryDialog";
import { useAppTranslation } from "../../i18n/i18n";

type RenameSkillFileModalProps = {
  opened: boolean;
  title: string;
  description: string;
  label: string;
  saving: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onRename: (name: string) => Promise<LibraryItemDocument | null>;
};

export function RenameLibraryItemFileModal({
  opened,
  title,
  description,
  label,
  saving,
  errorMessage,
  onClose,
  onRename,
}: RenameSkillFileModalProps) {
  const { t } = useAppTranslation();
  const [name, setName] = useState(label);

  useEffect(() => {
    if (!opened) return;
    setName(label);
  }, [label, opened]);

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
      title={title}
      description={description}
      label={t("file.name")}
      value={name}
      saving={saving}
      errorMessage={errorMessage}
      submitLabel={t("file.rename.submit")}
      onClose={onClose}
      onValueChange={setName}
      onSubmit={handleSubmit}
    />
  );
}
