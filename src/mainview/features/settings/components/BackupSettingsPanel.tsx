import {
  Button,
  Checkbox,
  Group,
  NumberInput,
  Stack,
  Switch,
  TextInput,
  Title,
} from "@mantine/core";
import { GitBranch, RotateCcw, Trash2, UploadCloud } from "lucide-react";
import type { GitBackupConfig, GitBackupRestoreMode } from "../../../../shared/types";
import { DialogErrorMessage } from "../../../components/dialogs/DialogErrorMessage";
import { useAppTranslation } from "../../../i18n/i18n";
import type { GitBackupIssue } from "../model/gitBackup";

export type BackupSettingsPanelProps = {
  config: GitBackupConfig;
  configured: boolean;
  issue: GitBackupIssue;
  errorMessage: string | null;
  restoreDisabled: boolean;
  restoreNeedsConfirmation: boolean;
  restoring: boolean;
  onConfigChange: <K extends keyof GitBackupConfig>(key: K, value: GitBackupConfig[K]) => void;
  onReset: () => void;
  onRestore: (mode: GitBackupRestoreMode) => void;
  onSetup: () => void;
};

export function BackupSettingsPanel({
  config,
  configured,
  issue,
  errorMessage,
  restoreDisabled,
  restoreNeedsConfirmation,
  restoring,
  onConfigChange,
  onReset,
  onRestore,
  onSetup,
}: BackupSettingsPanelProps) {
  const { t } = useAppTranslation();
  const firstTimeSetup = !configured;

  return (
    <Stack gap="lg">
      <Stack gap={6}>
        <Title order={4}>{t("settings.backup.title")}</Title>
      </Stack>

      <Stack gap="sm">
        <TextInput
          label={t("settings.backup.remoteUrl")}
          placeholder={t("settings.backup.remoteUrlPlaceholder")}
          value={config.remoteUrl}
          error={issue.remoteUrl ? t(issue.remoteUrl) : null}
          onChange={(event) => onConfigChange("remoteUrl", event.currentTarget.value)}
        />
        {configured ? (
          <TextInput
            label={t("settings.backup.branch")}
            placeholder={t("settings.backup.branchPlaceholder")}
            value={config.branch}
            error={issue.branch ? t(issue.branch) : null}
            leftSection={<GitBranch size={16} />}
            onChange={(event) => onConfigChange("branch", event.currentTarget.value)}
          />
        ) : null}
      </Stack>

      {firstTimeSetup ? (
        <Group gap="sm">
          <Button
            leftSection={<UploadCloud size={16} />}
            onClick={onSetup}
            disabled={restoreDisabled}
          >
            {t("settings.backup.setupBackup")}
          </Button>
          <Button
            variant={restoreNeedsConfirmation ? "filled" : "default"}
            color={restoreNeedsConfirmation ? "red" : "gray"}
            loading={restoring}
            disabled={restoreDisabled}
            leftSection={<RotateCcw size={16} />}
            onClick={() => onRestore(restoreNeedsConfirmation ? "replace" : "safe")}
          >
            {restoreNeedsConfirmation
              ? t("settings.backup.restoreReplace")
              : t("settings.backup.restoreFromGit")}
          </Button>
        </Group>
      ) : (
        <>
          <Stack gap="xs">
            <Title order={5}>{t("settings.backup.includeTitle")}</Title>
            <Checkbox
              checked={config.includeSettings}
              onChange={(event) => onConfigChange("includeSettings", event.currentTarget.checked)}
              label={t("settings.backup.includeSettings")}
            />
            <Checkbox
              checked={config.includeDefaultLibrary}
              onChange={(event) =>
                onConfigChange("includeDefaultLibrary", event.currentTarget.checked)
              }
              label={t("settings.backup.includeDefaultLibrary")}
            />
          </Stack>

          <Stack gap={6}>
            <Title order={5}>{t("settings.backup.automationTitle")}</Title>
            <Switch
              checked={config.enabled}
              onChange={(event) => onConfigChange("enabled", event.currentTarget.checked)}
              label={t("settings.backup.enabled")}
              description={t("settings.backup.enabledDescription")}
            />
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

          <Group gap="sm">
            <Button
              variant="default"
              color="red"
              leftSection={<Trash2 size={16} />}
              onClick={onReset}
            >
              {t("settings.backup.reset")}
            </Button>
          </Group>
        </>
      )}

      <DialogErrorMessage message={errorMessage} />
    </Stack>
  );
}
