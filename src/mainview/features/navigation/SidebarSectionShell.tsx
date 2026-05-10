import { Group, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

type SidebarSectionShellProps = {
  title: string;
  children: ReactNode;
  action?: ReactNode;
};

export function SidebarSectionShell({ title, children, action }: SidebarSectionShellProps) {
  return (
    <div className="sidebar-scope-section">
      <Group justify="space-between" align="center" wrap="nowrap">
        <Text size="xs" tt="uppercase" fw={700} className="sidebar-section-title">
          {title}
        </Text>
        {action}
      </Group>
      <Stack gap={4} mt="sm" className="sidebar-scope-list">
        {children}
      </Stack>
    </div>
  );
}
