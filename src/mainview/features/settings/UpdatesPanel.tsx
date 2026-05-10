import { Button, Code, Group, Stack, Text, Title } from "@mantine/core";
import type { AppUpdateState, UpdateStatusEntry } from "../../../shared/updates";
import { DialogErrorMessage } from "../../components/dialogs/DialogErrorMessage";
import { useAppTranslation } from "../../i18n/i18n";

export type UpdatesPanelProps = {
  updateState: AppUpdateState | null;
  loading: boolean;
  checking: boolean;
  downloading: boolean;
  applying: boolean;
  errorMessage: string | null;
  onCheckForUpdates: () => void;
  onDownloadUpdate: () => void;
  onApplyUpdate: () => void;
};

function formatTimestamp(entry: UpdateStatusEntry | null) {
  if (!entry) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(entry.timestamp);
}

export function UpdatesPanel({
  updateState,
  loading,
  checking,
  downloading,
  applying,
  errorMessage,
  onCheckForUpdates,
  onDownloadUpdate,
  onApplyUpdate,
}: UpdatesPanelProps) {
  const { t } = useAppTranslation();
  const localInfo = updateState?.localInfo;
  const updateInfo = updateState?.updateInfo;
  const latestStatus = updateState?.latestStatus ?? null;
  const checkedAt = formatTimestamp(latestStatus);
  const updatesDisabled = localInfo?.channel === "dev";
  const updateReady = updateInfo?.updateReady ?? false;
  const updateAvailable = updateInfo?.updateAvailable ?? false;

  return (
    <Stack gap="lg" pt="md">
      <Stack gap={6}>
        <Title order={4}>{t("updates.title")}</Title>
      </Stack>

      <Stack gap={4}>
        <Text size="sm">
          {t("updates.currentVersion")}{" "}
          <Code>{localInfo?.version ?? (loading ? t("common.loading") : t("common.unknown"))}</Code>
        </Text>
        <Text size="sm">
          {t("updates.channel")} <Code>{localInfo?.channel ?? t("common.unknown")}</Code>
        </Text>
        <Text size="sm">
          {t("updates.releaseHost")} <Code>{localInfo?.baseUrl ?? t("common.unknown")}</Code>
        </Text>
        {updateInfo?.version ? (
          <Text size="sm">
            {t("updates.latestKnownRelease")} <Code>{updateInfo.version}</Code>
          </Text>
        ) : null}
      </Stack>

      {updatesDisabled ? (
        <Text size="sm" c="dimmed">
          {t("updates.devDisabled")}
        </Text>
      ) : null}

      <Stack gap={4}>
        <Text size="sm" fw={600}>
          {t("updates.status")}
        </Text>
        <Text size="sm" c="dimmed">
          {latestStatus?.message ?? t("updates.notChecked")}
        </Text>
        {checkedAt ? (
          <Text size="xs" c="dimmed">
            {t("updates.lastEvent", { time: checkedAt })}
          </Text>
        ) : null}
      </Stack>

      <Group gap="sm">
        <Button
          onClick={onCheckForUpdates}
          loading={checking}
          disabled={loading || downloading || applying || updatesDisabled}
        >
          {t("updates.check")}
        </Button>
        <Button
          variant="default"
          color="gray"
          onClick={onDownloadUpdate}
          loading={downloading}
          disabled={
            loading || checking || applying || updatesDisabled || !updateAvailable || updateReady
          }
        >
          {t("updates.download")}
        </Button>
        <Button
          onClick={onApplyUpdate}
          loading={applying}
          disabled={loading || checking || downloading || !updateReady}
        >
          {t("updates.restart")}
        </Button>
      </Group>

      <DialogErrorMessage message={errorMessage} />
    </Stack>
  );
}
