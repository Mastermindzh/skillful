import { ActionIcon, Badge, Group, Menu, Scroller, Tabs } from "@mantine/core";
import { Ellipsis, Pencil, Plus, Trash2 } from "lucide-react";
import type { LibraryItemAdditionalFile, LibraryItemFile } from "../../../shared/types";
import { useAppTranslation } from "../../i18n/i18n";
import { visibleFileLabel } from "../skills/libraryItems";
import { ADDITIONAL_FILES_TAB } from "./constants";

type CurrentFileActions = {
  canManage: boolean;
  onCreate: () => void;
  onRename: () => void;
  onDelete: () => void;
};

type LibraryItemTabsBarProps = {
  files: LibraryItemFile[];
  additionalFiles: LibraryItemAdditionalFile[];
  dirtyRelativePaths: Set<string>;
  currentFileActions: CurrentFileActions;
};

export function LibraryItemTabsBar({
  files,
  additionalFiles,
  dirtyRelativePaths,
  currentFileActions,
}: LibraryItemTabsBarProps) {
  const { t } = useAppTranslation();

  return (
    <div className="editor-tabs-header">
      <Tabs.List>
        <Scroller className="file-tabs-scroller">
          {files.map((file) => (
            <Tabs.Tab
              key={file.relativePath}
              value={file.relativePath}
              className="file-tab"
              classNames={{ tabLabel: "file-tab-label-slot", tabSection: "file-tab-section" }}
              title={visibleFileLabel(file)}
              rightSection={
                dirtyRelativePaths.has(file.relativePath) ? <span className="dirty-dot" /> : null
              }
            >
              <span className="file-tab-label">{visibleFileLabel(file)}</span>
            </Tabs.Tab>
          ))}
          <Tabs.Tab
            value={ADDITIONAL_FILES_TAB}
            className="file-tab file-tab-additional"
            classNames={{ tabLabel: "file-tab-label-slot", tabSection: "file-tab-section" }}
          >
            <Group gap={6} wrap="nowrap">
              <span className="file-tab-label">{t("additionalFiles.tab")}</span>
              <Badge size="xs" variant="light" color="gray" className="file-tab-count">
                {additionalFiles.length}
              </Badge>
            </Group>
          </Tabs.Tab>
        </Scroller>
      </Tabs.List>
      <ActionIcon
        variant="subtle"
        size="sm"
        aria-label={t("file.create.ariaLabel")}
        onClick={currentFileActions.onCreate}
      >
        <Plus size={15} />
      </ActionIcon>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            size="sm"
            aria-label={t("file.manageCurrent")}
            disabled={!currentFileActions.canManage}
          >
            <Ellipsis size={15} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<Pencil size={14} />}
            disabled={!currentFileActions.canManage}
            onClick={currentFileActions.onRename}
          >
            {t("file.rename.title")}
          </Menu.Item>
          <Menu.Item
            color="red"
            leftSection={<Trash2 size={14} />}
            disabled={!currentFileActions.canManage}
            onClick={currentFileActions.onDelete}
          >
            {t("file.delete.title")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}
