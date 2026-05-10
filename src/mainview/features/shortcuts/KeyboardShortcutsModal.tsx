import { Kbd, Modal, SimpleGrid, Stack, Text } from "@mantine/core";
import { useAppTranslation } from "../../i18n/i18n";
import type { TranslationKey } from "../../i18n/messages";

type KeyboardShortcutsModalProps = {
  opened: boolean;
  onClose: () => void;
};

const shortcuts = [
  { keys: ["Ctrl", "F"], labelKey: "shortcuts.focusSearch" },
  { keys: ["Ctrl", ","], labelKey: "shortcuts.openSettings" },
  { keys: ["Ctrl", "R"], labelKey: "shortcuts.refreshLibrary" },
  { keys: ["Ctrl", "N"], labelKey: "shortcuts.createItem" },
  { keys: ["Ctrl", "S"], labelKey: "shortcuts.saveCurrentFile" },
  { keys: ["Ctrl", "Shift", "S"], labelKey: "shortcuts.saveAllFiles" },
  { keys: ["F2"], labelKey: "shortcuts.renameSelectedItem" },
  { keys: ["Delete"], labelKey: "shortcuts.deleteSelectedItem" },
  { keys: ["Shift", "?"], labelKey: "shortcuts.showShortcuts" },
] satisfies Array<{ keys: string[]; labelKey: TranslationKey }>;

export function KeyboardShortcutsModal({ opened, onClose }: KeyboardShortcutsModalProps) {
  const { t } = useAppTranslation();
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("shortcuts.title")}
      centered
      size="xl"
      classNames={{ content: "shortcuts-modal" }}
    >
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {t("shortcuts.macHint")}
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {shortcuts.map((shortcut) => (
            <div className="shortcut-row" key={shortcut.labelKey}>
              <Text size="sm">{t(shortcut.labelKey)}</Text>
              <span className="shortcut-keys">
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </SimpleGrid>
      </Stack>
    </Modal>
  );
}
