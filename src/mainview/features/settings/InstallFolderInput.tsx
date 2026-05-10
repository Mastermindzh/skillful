import { ActionIcon, TextInput } from "@mantine/core";
import { FolderOpen } from "lucide-react";
import { useAppTranslation } from "../../i18n/i18n";
import { preventFileUriDrop } from "./dnd";

type InstallFolderInputProps = {
  disabled?: boolean;
  error?: string;
  label: string;
  onChange: (value: string) => void;
  onPick: () => void;
  placeholder: string;
  value: string;
};

export function InstallFolderInput({
  disabled,
  error,
  label,
  onChange,
  onPick,
  placeholder,
  value,
}: InstallFolderInputProps) {
  const { t } = useAppTranslation();
  return (
    <TextInput
      label={label}
      placeholder={placeholder}
      value={value}
      error={error}
      disabled={disabled}
      onDragOver={preventFileUriDrop}
      onDrop={preventFileUriDrop}
      onChange={(event) => onChange(event.currentTarget.value)}
      rightSectionPointerEvents="all"
      rightSection={
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={onPick}
          aria-label={t("settings.tools.chooseFolder", { label })}
          disabled={disabled}
        >
          <FolderOpen size={16} />
        </ActionIcon>
      }
    />
  );
}
