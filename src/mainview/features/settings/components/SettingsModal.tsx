import { Button, Group, Modal, Stack, Tabs, Text } from "@mantine/core";
import { UploadCloud } from "lucide-react";
import { useState } from "react";
import { UnsavedChangesDialog } from "../../../components/UnsavedChangesDialog";
import { useAppTranslation } from "../../../i18n/i18n";
import type { SettingsTab } from "../state/useSettingsState";
import { BackupSettingsPanel, type BackupSettingsPanelProps } from "./BackupSettingsPanel";
import { DirtyTabLabel } from "./DirtyTabLabel";
import { GeneralSettingsPanel, type GeneralSettingsPanelProps } from "./GeneralSettingsPanel";
import { LibrarySettingsPanel, type LibrarySettingsPanelProps } from "./LibrarySettingsPanel";
import { ToolSettingsPanel, type ToolSettingsPanelProps } from "./ToolSettingsPanel";
import { UpdatesPanel, type UpdatesPanelProps } from "./UpdatesPanel";

type SettingsModalProps = {
  opened: boolean;
  activeTab: SettingsTab;
  general: GeneralSettingsPanelProps;
  library: LibrarySettingsPanelProps;
  tools: ToolSettingsPanelProps;
  backup: BackupSettingsPanelProps;
  updates: UpdatesPanelProps;
  footer: {
    hasChanges: boolean;
    saving: boolean;
    errorMessage: string | null;
    syncAfterSave: boolean;
    onClose: () => void;
    onSave: () => void;
  };
  dirtyTabs: {
    general: boolean;
    library: boolean;
    tools: boolean;
    backup: boolean;
  };
  onTabChange: (tab: SettingsTab) => void;
};

export function SettingsModal({
  opened,
  activeTab,
  general,
  library,
  tools,
  backup,
  updates,
  footer,
  dirtyTabs,
  onTabChange,
}: SettingsModalProps) {
  const { t } = useAppTranslation();
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const dirtyHint = t("settings.tabUnsavedIndicator");

  const requestClose = () => {
    if (footer.hasChanges) {
      setConfirmDiscardOpen(true);
      return;
    }
    footer.onClose();
  };

  const handleConfirmSave = () => {
    setConfirmDiscardOpen(false);
    footer.onSave();
  };

  const handleConfirmDiscard = () => {
    setConfirmDiscardOpen(false);
    footer.onClose();
  };

  const handleConfirmCancel = () => {
    setConfirmDiscardOpen(false);
  };
  const saveLabel = footer.syncAfterSave ? t("settings.saveAndSync") : t("settings.save");

  return (
    <>
      <Modal
        opened={opened}
        onClose={requestClose}
        title={t("settings.title")}
        centered
        size="lg"
        classNames={{ content: "settings-modal" }}
      >
        <Stack gap="lg">
          <Tabs value={activeTab} onChange={(value) => value && onTabChange(value as SettingsTab)}>
            <Tabs.List>
              <Tabs.Tab value="general">
                <DirtyTabLabel
                  label={t("settings.tab.general")}
                  dirty={dirtyTabs.general}
                  hint={dirtyHint}
                />
              </Tabs.Tab>
              <Tabs.Tab value="library">
                <DirtyTabLabel
                  label={t("settings.tab.library")}
                  dirty={dirtyTabs.library}
                  hint={dirtyHint}
                />
              </Tabs.Tab>
              <Tabs.Tab value="tools">
                <DirtyTabLabel
                  label={t("settings.tab.tools")}
                  dirty={dirtyTabs.tools}
                  hint={dirtyHint}
                />
              </Tabs.Tab>
              <Tabs.Tab value="backup">
                <DirtyTabLabel
                  label={t("settings.tab.backup")}
                  dirty={dirtyTabs.backup}
                  hint={dirtyHint}
                />
              </Tabs.Tab>
              <Tabs.Tab value="updates">{t("settings.tab.updates")}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="general" pt="md">
              <GeneralSettingsPanel {...general} />
            </Tabs.Panel>

            <Tabs.Panel value="library" pt="md">
              <LibrarySettingsPanel {...library} />
            </Tabs.Panel>

            <Tabs.Panel value="tools" pt="md">
              <ToolSettingsPanel {...tools} />
            </Tabs.Panel>

            <Tabs.Panel value="backup" pt="md">
              <BackupSettingsPanel {...backup} />
            </Tabs.Panel>

            <Tabs.Panel value="updates">
              <UpdatesPanel {...updates} />
            </Tabs.Panel>
          </Tabs>

          {footer.errorMessage ? (
            <Text size="sm" c="red.7">
              {footer.errorMessage}
            </Text>
          ) : null}

          <Group justify="flex-end" align="center" gap="sm">
            {activeTab === "updates" ? (
              <Button variant="default" color="gray" onClick={requestClose}>
                {t("settings.close")}
              </Button>
            ) : (
              <Group gap="sm">
                <Button variant="default" color="gray" onClick={requestClose}>
                  {t("settings.cancel")}
                </Button>
                <Button
                  onClick={footer.onSave}
                  loading={footer.saving}
                  leftSection={footer.syncAfterSave ? <UploadCloud size={16} /> : undefined}
                >
                  {saveLabel}
                </Button>
              </Group>
            )}
          </Group>
        </Stack>
      </Modal>
      <UnsavedChangesDialog
        opened={confirmDiscardOpen}
        onSave={handleConfirmSave}
        onDiscard={handleConfirmDiscard}
        onCancel={handleConfirmCancel}
      />
    </>
  );
}
