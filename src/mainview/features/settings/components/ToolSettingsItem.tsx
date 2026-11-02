import { Accordion, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { Minus, ScrollText, Undo2 } from "lucide-react";
import type { Platform } from "../../../../shared/types";
import { useAppTranslation } from "../../../i18n/i18n";
import type { ToolRow, ToolRowIssue } from "../model/tools";
import { preventFileUriDrop } from "../utils/dnd";
import { InstallFolderInput } from "./InstallFolderInput";
import { OtherPlatformPathNotice } from "./OtherPlatformPathNotice";
import { PendingRemovalBadge } from "./PendingRemovalBadge";

type ToolSettingsItemProps = {
  issue?: ToolRowIssue | null;
  label: string;
  platform?: Platform;
  onChange: (
    id: string,
    field: "name" | "skillInstallRoot" | "agentInstallRoot" | "instructionsPath",
    value: string
  ) => void;
  onPickInstallFolder: (
    id: string,
    field: "skillInstallRoot" | "agentInstallRoot"
  ) => Promise<string | null>;
  onRemove: (id: string) => void;
  onRestore: (id: string) => void;
  onEditInstructions: (id: string) => void;
  tool: ToolRow;
};

export function ToolSettingsItem({
  issue,
  label,
  platform,
  onChange,
  onPickInstallFolder,
  onRemove,
  onRestore,
  onEditInstructions,
  tool,
}: ToolSettingsItemProps) {
  const { t } = useAppTranslation();
  const pending = Boolean(tool.pendingRemoval);
  return (
    <Accordion.Item
      value={tool.id}
      className={pending ? "settings-row-pending-removal" : undefined}
    >
      <Accordion.Control>
        <Group gap="sm" wrap="nowrap">
          <Text
            component="span"
            td={pending ? "line-through" : undefined}
            c={pending ? "dimmed" : undefined}
          >
            {label}
          </Text>
          {pending ? <PendingRemovalBadge /> : null}
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="sm">
          <TextInput
            label={t("settings.tools.name")}
            placeholder={t("settings.tools.namePlaceholder")}
            value={tool.name}
            error={issue?.name ? t(issue.name) : undefined}
            disabled={pending}
            onDragOver={preventFileUriDrop}
            onDrop={preventFileUriDrop}
            onChange={(event) => onChange(tool.id, "name", event.currentTarget.value)}
          />
          <InstallFolderInput
            label={t("settings.tools.skillFolder")}
            placeholder={t("settings.tools.skillFolderPlaceholder")}
            value={tool.skillInstallRoot}
            error={issue?.skillInstallRoot ? t(issue.skillInstallRoot) : undefined}
            disabled={pending}
            onChange={(value) => onChange(tool.id, "skillInstallRoot", value)}
            onPick={() => void onPickInstallFolder(tool.id, "skillInstallRoot")}
          />
          {issue?.skillInstallRoot || pending ? null : (
            <OtherPlatformPathNotice path={tool.skillInstallRoot} platform={platform} />
          )}
          <InstallFolderInput
            label={t("settings.tools.agentFolder")}
            placeholder={t("settings.tools.agentFolderPlaceholder")}
            value={tool.agentInstallRoot}
            error={issue?.agentInstallRoot ? t(issue.agentInstallRoot) : undefined}
            disabled={pending}
            onChange={(value) => onChange(tool.id, "agentInstallRoot", value)}
            onPick={() => void onPickInstallFolder(tool.id, "agentInstallRoot")}
          />
          {issue?.agentInstallRoot || pending ? null : (
            <OtherPlatformPathNotice path={tool.agentInstallRoot} platform={platform} />
          )}
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <TextInput
              className="tool-instructions-path-input"
              style={{ flex: 1 }}
              label={t("settings.tools.instructionsFile")}
              description={t("settings.tools.instructionsFileDescription")}
              placeholder={t("settings.tools.instructionsFilePlaceholder")}
              value={tool.instructionsPath}
              error={issue?.instructionsPath ? t(issue.instructionsPath) : undefined}
              disabled={pending}
              onDragOver={preventFileUriDrop}
              onDrop={preventFileUriDrop}
              onChange={(event) => onChange(tool.id, "instructionsPath", event.currentTarget.value)}
            />
            <Button
              variant="light"
              leftSection={<ScrollText size={16} />}
              disabled={
                pending || !tool.instructionsPath.trim() || Boolean(issue?.instructionsPath)
              }
              onClick={() => onEditInstructions(tool.id)}
            >
              {t("settings.tools.editInstructions")}
            </Button>
          </Group>
          {issue?.instructionsPath || pending ? null : (
            <OtherPlatformPathNotice path={tool.instructionsPath} platform={platform} />
          )}
          {issue?.installRoots && !pending ? (
            <Text size="sm" c="red.7">
              {t(issue.installRoots)}
            </Text>
          ) : null}
          <Group justify="flex-end">
            {pending ? (
              <Button
                variant="default"
                color="gray"
                leftSection={<Undo2 size={16} />}
                onClick={() => onRestore(tool.id)}
              >
                {t("settings.tools.restoreTool")}
              </Button>
            ) : (
              <Button
                variant="default"
                color="gray"
                leftSection={<Minus size={16} />}
                onClick={() => onRemove(tool.id)}
              >
                {t("settings.tools.removeTool")}
              </Button>
            )}
          </Group>
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
