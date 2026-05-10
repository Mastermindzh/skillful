import { Button, Group } from "@mantine/core";
import type { ReactNode } from "react";

type DialogFooterProps = {
  confirmLabel: string;
  onConfirm?: () => void;
  confirmType?: "button" | "submit";
  confirmColor?: string;
  confirmVariant?: "filled" | "light" | "default" | "outline" | "subtle" | "transparent" | "white";
  confirmLoading?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;
  secondaryAction?: ReactNode;
};

export function DialogFooter({
  confirmLabel,
  onConfirm,
  confirmType = "button",
  confirmColor,
  confirmVariant,
  confirmLoading,
  confirmDisabled,
  children,
  secondaryAction,
}: DialogFooterProps) {
  return (
    <Group justify="flex-end" gap="sm">
      {children}
      {secondaryAction}
      <Button
        type={confirmType}
        color={confirmColor}
        variant={confirmVariant}
        loading={confirmLoading}
        disabled={confirmDisabled}
        onClick={confirmType === "button" ? onConfirm : undefined}
      >
        {confirmLabel}
      </Button>
    </Group>
  );
}
