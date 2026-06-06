import { ActionIcon, Checkbox, NumberInput, Stack, Switch, TextInput, Title } from "@mantine/core";
import { FolderOpen, GitBranch } from "lucide-react";
import type { GitBackupConfig } from "../../../shared/types";
import { DialogErrorMessage } from "../../components/dialogs/DialogErrorMessage";
import { useAppTranslation } from "../../i18n/i18n";
import { preventFileUriDrop } from "./dnd";
import type { GitBackupIssue } from "./gitBackup";

export type BackupSettingsPanelProps = {
  config: GitBackupConfig;
  issue: GitBackupIssue;
  errorMessage: string | null;
  onConfigChange: <K extends keyof GitBackupConfig>(key: K, value: GitBackupConfig[K]) => void;
  onPickRepository: () => void;
};

export function BackupSettingsPanel({
  config,
  issue,
  errorMessage,
  onConfigChange,
  onPickRepository,
}: BackupSettingsPanelProps) {
  const { t } = useAppTranslation();

  return (
    <Stack gap="lg">
      <Stack gap={6}>
        <Title order={4}>{t("settings.backup.title")}</Title>
        <Switch
          checked={config.enabled}
          onChange={(event) => onConfigChange("enabled", event.currentTarget.checked)}
          label={t("settings.backup.enabled")}
          description={t("settings.backup.enabledDescription")}
        />
      </Stack>

      <Stack gap="sm">
        <TextInput
          label={t("settings.backup.repositoryPath")}
          placeholder={t("settings.backup.repositoryPathPlaceholder")}
          value={config.repositoryPath}
          disabled={!config.enabled}
          error={issue.repositoryPath ? t(issue.repositoryPath) : null}
          onDragOver={preventFileUriDrop}
          onDrop={preventFileUriDrop}
          onChange={(event) => onConfigChange("repositoryPath", event.currentTarget.value)}
          rightSectionPointerEvents="auto"
          rightSection={
            <ActionIcon
              variant="subtle"
              size="sm"
              disabled={!config.enabled}
              onClick={onPickRepository}
              aria-label={t("settings.backup.chooseRepository")}
            >
              <FolderOpen size={16} />
            </ActionIcon>
          }
        />
        <TextInput
          label={t("settings.backup.remoteUrl")}
          placeholder={t("settings.backup.remoteUrlPlaceholder")}
          value={config.remoteUrl}
          disabled={!config.enabled}
          error={issue.remoteUrl ? t(issue.remoteUrl) : null}
          onChange={(event) => onConfigChange("remoteUrl", event.currentTarget.value)}
        />
        <TextInput
          label={t("settings.backup.branch")}
          placeholder={t("settings.backup.branchPlaceholder")}
          value={config.branch}
          disabled={!config.enabled}
          error={issue.branch ? t(issue.branch) : null}
          leftSection={<GitBranch size={16} />}
          onChange={(event) => onConfigChange("branch", event.currentTarget.value)}
        />
      </Stack>

      <Stack gap="xs">
        <Title order={5}>{t("settings.backup.includeTitle")}</Title>
        <Checkbox
          checked={config.includeSettings}
          disabled={!config.enabled}
          onChange={(event) => onConfigChange("includeSettings", event.currentTarget.checked)}
          label={t("settings.backup.includeSettings")}
        />
        <Checkbox
          checked={config.includeDefaultLibrary}
          disabled={!config.enabled}
          onChange={(event) => onConfigChange("includeDefaultLibrary", event.currentTarget.checked)}
          label={t("settings.backup.includeDefaultLibrary")}
        />
      </Stack>

      <Stack gap={6}>
        <Title order={5}>{t("settings.backup.automationTitle")}</Title>
        <Switch
          checked={config.autoBackup}
          disabled={!config.enabled}
          onChange={(event) => onConfigChange("autoBackup", event.currentTarget.checked)}
          label={t("settings.backup.autoBackup")}
          description={t("settings.backup.autoBackupDescription")}
        />
        <NumberInput
          label={t("settings.backup.autoBackupInterval")}
          value={config.autoBackupIntervalMinutes > 0 ? config.autoBackupIntervalMinutes : ""}
          min={1}
          step={1}
          allowDecimal={false}
          disabled={!config.enabled || !config.autoBackup}
          error={issue.autoBackupIntervalMinutes ? t(issue.autoBackupIntervalMinutes) : null}
          onChange={(value) =>
            onConfigChange(
              "autoBackupIntervalMinutes",
              typeof value === "number" ? value : Number(value) || 0
            )
          }
        />
      </Stack>

      <DialogErrorMessage message={errorMessage} />
    </Stack>
  );
}
