import { ActionIcon } from "@mantine/core";
import { forwardRef, type ReactNode } from "react";

type SidebarSectionActionButtonProps = {
  ariaLabel: string;
  onClick?: () => void;
  children: ReactNode;
};

export const SidebarSectionActionButton = forwardRef<
  HTMLButtonElement,
  SidebarSectionActionButtonProps
>(({ ariaLabel, onClick, children }, ref) => {
  return (
    <ActionIcon
      ref={ref}
      variant="subtle"
      size="sm"
      onClick={onClick}
      aria-label={ariaLabel}
      className="sidebar-section-action"
      style={{ color: "var(--app-sidebar-fg)" }}
    >
      {children}
    </ActionIcon>
  );
});

SidebarSectionActionButton.displayName = "SidebarSectionActionButton";
