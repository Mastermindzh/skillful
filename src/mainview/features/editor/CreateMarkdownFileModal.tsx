import type { ComponentPropsWithoutRef } from "react";
import { useState } from "react";
import { TextEntryDialog } from "../../components/dialogs/TextEntryDialog";
import { useOnDialogOpen } from "../../components/dialogs/useOnDialogOpen";
import { useAppTranslation } from "../../i18n/i18n";

type CreateMarkdownFileModalProps = {
  opened: boolean;
  saving: boolean;
  errorMessage: string | null;
  /** Defaults to the "new markdown file" texts used for library items. */
  title?: string;
  description?: string;
  placeholder?: string;
  onClose: () => void;
  /** Resolves to something truthy once the file was created. */
  onCreate: (name: string) => Promise<unknown>;
};

export function CreateMarkdownFileModal({
  opened,
  saving,
  errorMessage,
  title,
  description,
  placeholder,
  onClose,
  onCreate,
}: CreateMarkdownFileModalProps) {
  const { t } = useAppTranslation();
  const [name, setName] = useState("");

  useOnDialogOpen(opened, () => setName(""));

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
      title={title ?? t("file.create.title")}
      description={description ?? t("file.create.description")}
      label={t("file.name")}
      placeholder={placeholder ?? t("file.name.placeholder")}
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
