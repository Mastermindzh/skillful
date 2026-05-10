import { ActionIcon, Group, Menu, Text } from "@mantine/core";
import { ExternalLink, FolderOpen, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useContextMenuPosition } from "../../components/useContextMenuPosition";
import { useAppTranslation } from "../../i18n/i18n";

type AdditionalFileRowProps = {
  relativePath: string;
  absolutePath: string;
  label: string;
  actionPath: string | null;
  onRename: () => void;
  onReveal: () => Promise<void>;
  onOpen: () => Promise<void>;
  onDelete: () => void;
};

export function AdditionalFileRow({
  relativePath,
  absolutePath,
  label,
  actionPath,
  onRename,
  onReveal,
  onOpen,
  onDelete,
}: AdditionalFileRowProps) {
  const { t } = useAppTranslation();
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const allowContextMenuOpen = useRef(false);
  const contextMenu = useContextMenuPosition();

  return (
    <Menu
      opened={contextMenuOpen}
      onChange={(opened) => {
        if (!opened) {
          setContextMenuOpen(false);
          return;
        }
        if (allowContextMenuOpen.current) {
          setContextMenuOpen(true);
        }
      }}
      position="bottom-start"
      withinPortal
    >
      <Menu.Target>
        <contextMenu.Anchor x={contextMenu.position.x} y={contextMenu.position.y} />
      </Menu.Target>
      <fieldset
        className="additional-file-row"
        aria-label={t("file.actions", { name: label })}
        onContextMenu={(event) => {
          event.preventDefault();
          contextMenu.capturePosition(event);
          allowContextMenuOpen.current = true;
          setContextMenuOpen(true);
          window.setTimeout(() => {
            allowContextMenuOpen.current = false;
          }, 0);
        }}
      >
        <div className="additional-file-header">
          <Text size="sm" fw={600}>
            {relativePath}
          </Text>
          <Group gap={4} wrap="nowrap">
            <ActionIcon
              variant="subtle"
              size="md"
              aria-label={t("file.rename.title")}
              title={t("file.rename.title")}
              onClick={onRename}
            >
              <Pencil size={18} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              size="md"
              aria-label={t("common.openContainingFolder")}
              title={t("common.openContainingFolder")}
              loading={actionPath === `reveal:${absolutePath}`}
              onClick={() => void onReveal()}
            >
              <FolderOpen size={18} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              size="md"
              aria-label={t("file.openDefault")}
              title={t("file.openDefault")}
              loading={actionPath === `open:${absolutePath}`}
              onClick={() => void onOpen()}
            >
              <ExternalLink size={18} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              size="md"
              color="red"
              aria-label={t("file.delete.description", { name: label })}
              title={t("file.delete.title")}
              onClick={onDelete}
            >
              <Trash2 size={18} />
            </ActionIcon>
          </Group>
        </div>
        <Text size="xs" c="dimmed" className="additional-file-path">
          {absolutePath}
        </Text>
      </fieldset>
      <Menu.Dropdown>
        <Menu.Item leftSection={<Pencil size={14} />} onClick={onRename}>
          {t("file.rename.title")}
        </Menu.Item>
        <Menu.Item leftSection={<FolderOpen size={14} />} onClick={() => void onReveal()}>
          {t("common.openContainingFolder")}
        </Menu.Item>
        <Menu.Item leftSection={<ExternalLink size={14} />} onClick={() => void onOpen()}>
          {t("file.openDefault")}
        </Menu.Item>
        <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={onDelete}>
          {t("file.delete.title")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
