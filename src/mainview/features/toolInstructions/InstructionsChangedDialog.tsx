import { Button, Code, List, Modal, Stack, Text } from "@mantine/core";
import { DialogFooter } from "../../components/dialogs/DialogFooter";
import { useAppTranslation } from "../../i18n/i18n";

type InstructionsChangedDialogProps = {
  opened: boolean;
  paths: string[];
  saving: boolean;
  onOverwrite: () => void;
  onReload: () => void;
  onCancel: () => void;
};

export function InstructionsChangedDialog({
  opened,
  paths,
  saving,
  onOverwrite,
  onReload,
  onCancel,
}: InstructionsChangedDialogProps) {
  const { t } = useAppTranslation();
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={t("instructions.changed.title")}
      centered
      size="sm"
    >
      <Stack gap="md">
        <Text size="sm">{t("instructions.changed.description")}</Text>
        <List size="sm">
          {paths.map((path) => (
            <List.Item key={path}>
              <Code>{path}</Code>
            </List.Item>
          ))}
        </List>
        <DialogFooter
          onConfirm={onOverwrite}
          confirmLabel={t("instructions.changed.overwrite")}
          confirmColor="red"
          confirmLoading={saving}
          secondaryAction={
            <Button variant="light" onClick={onReload} disabled={saving}>
              {t("instructions.changed.reload")}
            </Button>
          }
        />
      </Stack>
    </Modal>
  );
}
