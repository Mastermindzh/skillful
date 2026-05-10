import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useState } from "react";
import type { LibraryItemDocument } from "../../../shared/types";
import { TextEntryDialog } from "../../components/dialogs/TextEntryDialog";
import { useAppTranslation } from "../../i18n/i18n";

type CreateSkillFileModalProps = {
  opened: boolean;
  saving: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onCreate: (name: string) => Promise<LibraryItemDocument | null>;
};

export function CreateLibraryItemFileModal({
  opened,
  saving,
  errorMessage,
  onClose,
  onCreate,
}: CreateSkillFileModalProps) {
  const { t } = useAppTranslation();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!opened) {
      setName("");
    }
  }, [opened]);

  const handleSubmit: ComponentPropsWithoutRef<"form">["onSubmit"] = async (event) => {
    event.preventDefault();
    const created = await onCreate(name);
    if (created) {
      setName("");
    }
  };

  return (
    <TextEntryDialog
      opened={opened}
      title={t("file.create.title")}
      description={t("file.create.description")}
      label={t("file.name")}
      placeholder={t("file.name.placeholder")}
      value={name}
      saving={saving}
      errorMessage={errorMessage}
      submitLabel={t("file.create.submit")}
      onClose={onClose}
      onValueChange={setName}
      onSubmit={handleSubmit}
    />
  );
}
