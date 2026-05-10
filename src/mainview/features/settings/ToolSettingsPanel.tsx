import { Accordion, Button, Group, Stack, Text, Title } from "@mantine/core";
import { Plus } from "lucide-react";
import type { ToolPreset } from "../../../shared/toolPresets";
import { useAppTranslation } from "../../i18n/i18n";
import { toolIcon } from "../tools/presentation";
import { ToolSettingsItem } from "./ToolSettingsItem";
import type { ToolRow, ToolRowIssue } from "./tools";

export type ToolSettingsPanelProps = {
  activeRowId: string | null;
  tools: ToolRow[];
  availablePresets: ToolPreset[];
  validationById: Record<string, ToolRowIssue | null>;
  onToolChange: (
    id: string,
    field: "name" | "skillInstallRoot" | "agentInstallRoot",
    value: string
  ) => void;
  onPickInstallFolder: (
    id: string,
    field: "skillInstallRoot" | "agentInstallRoot"
  ) => Promise<string | null>;
  onAddTool: () => void;
  onAddPreset: (presetId: ToolPreset["id"]) => void;
  onRemoveTool: (id: string) => void;
  onRestoreTool: (id: string) => void;
  onActiveRowChange: (id: string | null) => void;
};

export function ToolSettingsPanel({
  activeRowId,
  tools,
  availablePresets,
  validationById,
  onToolChange,
  onPickInstallFolder,
  onAddTool,
  onAddPreset,
  onRemoveTool,
  onRestoreTool,
  onActiveRowChange,
}: ToolSettingsPanelProps) {
  const { t } = useAppTranslation();
  return (
    <Stack gap="lg">
      <Stack gap={6}>
        <Title order={4}>{t("settings.tab.tools")}</Title>
        <Text size="sm" c="dimmed">
          {t("settings.tools.description")}
        </Text>
      </Stack>

      {availablePresets.length > 0 ? (
        <Stack gap={8} className="tool-preset-quick-add">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            {t("settings.tools.quickAdd")}
          </Text>
          <Group gap="xs">
            {availablePresets.map((preset) => (
              <Button
                key={preset.id}
                variant="light"
                color="gray"
                size="sm"
                leftSection={<Plus size={14} />}
                className="tool-preset-add-button"
                onClick={() => onAddPreset(preset.id)}
              >
                <Group gap={6} wrap="nowrap" align="center">
                  {toolIcon(preset.icon, 14)}
                  <span>{preset.name}</span>
                </Group>
              </Button>
            ))}
          </Group>
        </Stack>
      ) : null}

      <Stack gap="sm">
        <Accordion
          variant="contained"
          value={activeRowId}
          onChange={(value) => onActiveRowChange(value)}
        >
          {tools.map((tool, index) => {
            const issue = validationById[tool.id];
            const label = tool.name.trim() || t("settings.tools.defaultName", { index: index + 1 });
            return (
              <ToolSettingsItem
                key={tool.id}
                tool={tool}
                label={label}
                issue={issue}
                onChange={onToolChange}
                onPickInstallFolder={onPickInstallFolder}
                onRemove={onRemoveTool}
                onRestore={onRestoreTool}
              />
            );
          })}
        </Accordion>
      </Stack>

      <Group justify="space-between" align="center">
        <Button variant="default" color="gray" leftSection={<Plus size={16} />} onClick={onAddTool}>
          {t("settings.tools.addTool")}
        </Button>
        <div />
      </Group>
    </Stack>
  );
}
