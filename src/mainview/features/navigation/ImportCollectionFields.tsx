import { ActionIcon, Button, Text, TextInput } from "@mantine/core";
import { ChevronDown, FileArchive, FolderOpen } from "lucide-react";
import { useAppTranslation } from "../../i18n/i18n";

type FileSourceImportFieldsProps = {
  label: string;
  placeholder: string;
  value: string;
  error?: string;
  pickAriaLabel: string;
  mode: "archive" | "folder";
  sourceName: string;
  onPickSource: () => void;
};

export function FileSourceImportFields({
  label,
  placeholder,
  value,
  error,
  pickAriaLabel,
  mode,
  sourceName,
  onPickSource,
}: FileSourceImportFieldsProps) {
  const { t } = useAppTranslation();
  return (
    <>
      <TextInput
        label={label}
        placeholder={placeholder}
        value={value}
        readOnly
        error={error}
        rightSectionWidth={42}
        rightSection={
          <ActionIcon variant="subtle" aria-label={pickAriaLabel} onClick={onPickSource}>
            {mode === "archive" ? <FileArchive size={18} /> : <FolderOpen size={18} />}
          </ActionIcon>
        }
      />

      {sourceName ? (
        <Text size="sm" c="dimmed">
          {t("import.importingFrom", { source: sourceName })}
        </Text>
      ) : null}
    </>
  );
}

type GitHubImportFieldsProps = {
  repo: string;
  ref: string;
  path: string;
  repoError?: string;
  refError?: string;
  pathError?: string;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  onRepoChange: (value: string) => void;
  onRefChange: (value: string) => void;
  onPathChange: (value: string) => void;
};

export function GitHubImportFields({
  repo,
  ref,
  path,
  repoError,
  refError,
  pathError,
  advancedOpen,
  onToggleAdvanced,
  onRepoChange,
  onRefChange,
  onPathChange,
}: GitHubImportFieldsProps) {
  const { t } = useAppTranslation();
  return (
    <>
      <TextInput
        label={t("import.github.repository")}
        placeholder={t("import.github.repositoryPlaceholder")}
        value={repo}
        onChange={(event) => onRepoChange(event.currentTarget.value)}
        error={repoError}
      />

      <Button
        type="button"
        variant="subtle"
        color="gray"
        justify="flex-start"
        leftSection={
          <ChevronDown
            size={16}
            style={{
              transform: advancedOpen ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform 120ms ease",
            }}
          />
        }
        onClick={onToggleAdvanced}
      >
        {t("import.github.advanced")}
      </Button>

      {advancedOpen ? (
        <div className="import-advanced-fields">
          <TextInput
            label={t("import.github.ref")}
            placeholder={t("import.github.refPlaceholder")}
            value={ref}
            onChange={(event) => onRefChange(event.currentTarget.value)}
            error={refError}
          />

          <TextInput
            label={t("import.github.path")}
            placeholder={t("import.github.pathPlaceholder")}
            value={path}
            onChange={(event) => onPathChange(event.currentTarget.value)}
            error={pathError}
          />
        </div>
      ) : null}
    </>
  );
}
