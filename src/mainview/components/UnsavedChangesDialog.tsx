import { Button, Modal, Stack, Text } from "@mantine/core";
import { useAppTranslation } from "../i18n/i18n";
import { DialogFooter } from "./dialogs/DialogFooter";

type UnsavedChangesDialogProps = {
  opened: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export function UnsavedChangesDialog({
  opened,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  const { t } = useAppTranslation();
  return (
    <Modal opened={opened} onClose={onCancel} title={t("unsaved.title")} centered size="sm">
      <Stack gap="lg">
        <Text size="sm">{t("unsaved.description")}</Text>
        <DialogFooter
          onConfirm={onSave}
          confirmLabel={t("details.saveAll")}
          secondaryAction={
            <Button variant="light" color="red" onClick={onDiscard}>
              {t("common.discard")}
            </Button>
          }
        />
      </Stack>
    </Modal>
  );
}
