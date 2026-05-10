import { Modal, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { DialogErrorMessage } from "./DialogErrorMessage";
import { DialogFooter } from "./DialogFooter";

type ConfirmDialogProps = {
  opened: boolean;
  title: string;
  description: ReactNode;
  confirming: boolean;
  errorMessage: string | null;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  opened,
  title,
  description,
  confirming,
  errorMessage,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal opened={opened} onClose={onCancel} title={title} centered size="sm">
      <Stack gap="md">
        {typeof description === "string" ? <Text size="sm">{description}</Text> : description}
        <DialogErrorMessage message={errorMessage} />
        <DialogFooter
          onConfirm={onConfirm}
          confirmLabel={confirmLabel}
          confirmColor="red"
          confirmLoading={confirming}
        />
      </Stack>
    </Modal>
  );
}
