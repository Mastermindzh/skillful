import { Badge, Button, Group, Menu, Text } from "@mantine/core";
import { ChevronDown } from "lucide-react";
import { useMemo } from "react";
import type { LibraryItemToolStatus } from "../../../shared/types";
import { useAppTranslation } from "../../i18n/i18n";
import { summarizeToolStatuses, toolActionLabel, toolStatusColor, toolStatusLabel } from "./status";

type ToolStatusPanelProps = {
  statuses: LibraryItemToolStatus[];
  activeActionToolId: string | null;
  onRefresh: () => void;
  onInstall: (toolId: string) => void;
  onRemove: (toolId: string) => void;
  onRepair: (toolId: string) => void;
};

export function ToolStatusPanel({
  statuses,
  activeActionToolId,
  onRefresh,
  onInstall,
  onRemove,
  onRepair,
}: ToolStatusPanelProps) {
  const { t } = useAppTranslation();
  const summary = useMemo(() => summarizeToolStatuses(statuses, t), [statuses, t]);

  return (
    <div className="tool-install-control">
      <Group gap="xs" align="center" wrap="nowrap" className="tool-status-summary">
        {summary.length > 0 ? (
          summary.map((item) => (
            <Badge
              key={item.state}
              size="sm"
              variant="light"
              color={toolStatusColor(item.state)}
              className="tool-status-badge"
            >
              {item.label} {item.count}
            </Badge>
          ))
        ) : (
          <Badge size="sm" variant="light" color="gray" className="tool-status-badge">
            {t("tool.noInstalls")}
          </Badge>
        )}
        <Menu
          position="bottom-end"
          width={360}
          withinPortal
          disabled={statuses.length === 0}
          onOpen={onRefresh}
        >
          <Menu.Target>
            <Button
              size="xs"
              variant="filled"
              rightSection={<ChevronDown size={14} />}
              disabled={statuses.length === 0}
              className="tool-install-button"
            >
              {t("tool.action.install")}
            </Button>
          </Menu.Target>
          <Menu.Dropdown className="tool-install-menu">
            <Menu.Label>{t("tool.destinations")}</Menu.Label>
            {statuses.map((status) => (
              <Menu.Item
                key={status.toolId}
                onClick={() => runStatusAction(status, onInstall, onRemove, onRepair)}
              >
                <div className="tool-install-menu-row">
                  <div className="tool-status-copy">
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" fw={600} truncate>
                        {status.toolName}
                      </Text>
                      <Badge
                        size="xs"
                        variant="light"
                        color={toolStatusColor(status.state)}
                        className="tool-status-badge"
                      >
                        {toolStatusLabel(status.state, t)}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" className="tool-status-details">
                      {status.details}
                    </Text>
                  </div>
                  <Text size="xs" fw={700} c="dimmed" className="tool-install-action-label">
                    {activeActionToolId === status.toolId
                      ? t("tool.working")
                      : toolActionLabel(status.state, t)}
                  </Text>
                </div>
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>
    </div>
  );
}

function runStatusAction(
  status: LibraryItemToolStatus,
  onInstall: (toolId: string) => void,
  onRemove: (toolId: string) => void,
  onRepair: (toolId: string) => void
) {
  if (status.state === "installed") {
    onRemove(status.toolId);
    return;
  }
  if (status.state === "broken") {
    onRepair(status.toolId);
    return;
  }
  if (status.state === "conflict") {
    return;
  }
  onInstall(status.toolId);
}
