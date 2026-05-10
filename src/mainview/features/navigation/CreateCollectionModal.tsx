import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useState } from "react";
import { TextEntryDialog } from "../../components/dialogs/TextEntryDialog";
import { useAppTranslation } from "../../i18n/i18n";

type CreateCollectionModalProps = {
  opened: boolean;
  saving: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onCreate: (name: string) => Promise<boolean>;
};

export function CreateCollectionModal({
  opened,
  saving,
  errorMessage,
  onClose,
  onCreate,
}: CreateCollectionModalProps) {
  const { t } = useAppTranslation();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!opened) setName("");
  }, [opened]);

  const handleSubmit: ComponentPropsWithoutRef<"form">["onSubmit"] = async (event) => {
    event.preventDefault();
    const created = await onCreate(name);
    if (created) setName("");
  };

  return (
    <TextEntryDialog
      opened={opened}
      title={t("collection.create.title")}
      description={t("collection.create.description")}
      label={t("collection.name")}
      placeholder={t("collection.name.placeholder")}
      value={name}
      saving={saving}
      errorMessage={errorMessage}
      submitLabel={t("collection.create.submit")}
      onClose={onClose}
      onValueChange={setName}
      onSubmit={handleSubmit}
    />
  );
}
