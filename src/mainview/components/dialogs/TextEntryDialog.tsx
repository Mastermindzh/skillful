import { Modal, Stack, Text, TextInput } from "@mantine/core";
import type { ComponentPropsWithoutRef } from "react";
import { DialogErrorMessage } from "./DialogErrorMessage";
import { DialogFooter } from "./DialogFooter";

type TextEntryDialogProps = {
  opened: boolean;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  value: string;
  saving: boolean;
  errorMessage: string | null;
  submitLabel: string;
  onClose: () => void;
  onValueChange: (value: string) => void;
  onSubmit: ComponentPropsWithoutRef<"form">["onSubmit"];
  canSubmit?: boolean;
};

export function TextEntryDialog({
  opened,
  title,
  description,
  label,
  placeholder,
  value,
  saving,
  errorMessage,
  submitLabel,
  onClose,
  onValueChange,
  onSubmit,
  canSubmit = value.trim().length > 0,
}: TextEntryDialogProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          {description ? (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          ) : null}
          <TextInput
            label={label}
            placeholder={placeholder}
            value={value}
            onChange={(event) => onValueChange(event.currentTarget.value)}
            data-autofocus
          />
          <DialogErrorMessage message={errorMessage} />
          <DialogFooter
            confirmType="submit"
            confirmLabel={submitLabel}
            confirmLoading={saving}
            confirmDisabled={!canSubmit}
          />
        </Stack>
      </form>
    </Modal>
  );
}
