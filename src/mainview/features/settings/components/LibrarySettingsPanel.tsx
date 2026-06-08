import { ActionIcon, Button, Group, Stack, Text, TextInput, Title } from "@mantine/core";
import { Minus, Plus, Undo2 } from "lucide-react";
import { useAppTranslation } from "../../../i18n/i18n";
import type { ScanRootIssue, ScanRootRow } from "../model/scanRoots";
import { preventFileUriDrop } from "../utils/dnd";
import { PendingRemovalBadge } from "./PendingRemovalBadge";

export type LibrarySettingsPanelProps = {
  defaultScanRoot: string;
  scanRoots: ScanRootRow[];
  validationById: Record<string, ScanRootIssue | null>;
  onScanRootChange: (id: string, value: string) => void;
  onAddScanRoot: () => void;
  onRemoveScanRoot: (id: string) => void;
  onRestoreScanRoot: (id: string) => void;
};

export function LibrarySettingsPanel({
  defaultScanRoot,
  scanRoots,
  validationById,
  onScanRootChange,
  onAddScanRoot,
  onRemoveScanRoot,
  onRestoreScanRoot,
}: LibrarySettingsPanelProps) {
  const { t } = useAppTranslation();
  return (
    <Stack gap="lg">
      <Stack gap={6}>
        <Title order={4}>{t("settings.library.title")}</Title>
        <Text size="sm" c="dimmed">
          {t("settings.library.description", { path: defaultScanRoot })}
        </Text>
      </Stack>

      <Stack gap="sm">
        {scanRoots.map((scanRoot, index) => {
          const pending = Boolean(scanRoot.pendingRemoval);
          const issue = validationById[scanRoot.id];
          return (
            <Stack
              key={scanRoot.id}
              gap={4}
              className={pending ? "settings-row-pending-removal" : undefined}
            >
              <Group align="flex-end" wrap="nowrap">
                <TextInput
                  flex={1}
                  placeholder={t("settings.library.placeholder")}
                  value={scanRoot.path}
                  disabled={pending}
                  onDragOver={preventFileUriDrop}
                  onDrop={preventFileUriDrop}
                  onChange={(event) => onScanRootChange(scanRoot.id, event.currentTarget.value)}
                />
                {pending ? (
                  <ActionIcon
                    variant="default"
                    color="gray"
                    size={36}
                    onClick={() => onRestoreScanRoot(scanRoot.id)}
                    aria-label={t("settings.library.restorePath", { index: index + 1 })}
                  >
                    <Undo2 size={16} />
                  </ActionIcon>
                ) : (
                  <ActionIcon
                    variant="default"
                    color="gray"
                    size={36}
                    onClick={() => onRemoveScanRoot(scanRoot.id)}
                    aria-label={t("settings.library.removePath", { index: index + 1 })}
                  >
                    <Minus size={16} />
                  </ActionIcon>
                )}
              </Group>
              {pending ? (
                <Group gap={6}>
                  <PendingRemovalBadge labelKey="settings.library.markedForRemoval" />
                </Group>
              ) : null}
              {issue && !pending ? (
                <Text size="xs" c="red.6">
                  {t(issue.messageKey ?? "settings.error.absolutePath", {
                    ...(issue.values ?? {}),
                  })}
                </Text>
              ) : null}
            </Stack>
          );
        })}
      </Stack>

      <Group justify="space-between" align="center">
        <Button
          variant="default"
          color="gray"
          leftSection={<Plus size={16} />}
          onClick={onAddScanRoot}
        >
          {t("settings.library.addFolder")}
        </Button>
        <div />
      </Group>
    </Stack>
  );
}
