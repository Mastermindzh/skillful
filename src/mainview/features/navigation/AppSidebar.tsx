import {
  ActionIcon,
  Group,
  Menu,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
} from "@mantine/core";
import {
  ArrowDownToLine,
  Download,
  Ellipsis,
  FileArchive,
  Keyboard,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Sun,
  Trash2,
} from "lucide-react";
import { type MouseEvent, memo, useMemo, useState } from "react";
import type { ToolIconKey } from "../../../shared/toolPresets";
import { useContextMenuPosition } from "../../components/useContextMenuPosition";
import { useAppTranslation } from "../../i18n/i18n";
import { toolIcon } from "../tools/presentation";
import { SidebarSectionActionButton } from "./SidebarSectionActionButton";
import { SidebarSectionShell } from "./SidebarSectionShell";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

type SidebarCollection = {
  id: string;
  title: string;
  count: number;
};

type SidebarTool = {
  id: string;
  title: string;
  count: number;
  icon: ToolIconKey;
};

type AppSidebarProps = {
  collections: SidebarCollection[];
  tools: SidebarTool[];
  selectedScope: string;
  refreshing: boolean;
  onSelectScope: (scope: string) => void;
  onRefresh: () => void;
  onCreateCollection: () => void;
  onImportCollection: () => void;
  onRenameCollection: (collection: SidebarCollection) => void;
  onDeleteCollection: (collection: SidebarCollection) => void;
  onExportCollection: (collection: SidebarCollection) => void;
  onOpenSettings: (tab?: "general" | "library" | "tools" | "updates") => void;
  updateAvailable: boolean;
  updateReady: boolean;
  onOpenUpdates: () => void;
  onOpenShortcuts: () => void;
};

export const AppSidebar = memo(function AppSidebar({
  collections,
  tools,
  selectedScope,
  refreshing,
  onSelectScope,
  onRefresh,
  onCreateCollection,
  onImportCollection,
  onRenameCollection,
  onDeleteCollection,
  onExportCollection,
  onOpenSettings,
  updateAvailable,
  updateReady,
  onOpenUpdates,
  onOpenShortcuts,
}: AppSidebarProps) {
  const { t } = useAppTranslation();
  const totalSkills = collections.reduce((total, collection) => total + collection.count, 0);
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const showUpdateAction = updateAvailable || updateReady;
  const updateLabel = updateReady
    ? t("sidebar.restartToApplyUpdate")
    : t("sidebar.updateAvailable");
  const sortedCollections = useMemo(
    () => [...collections].sort((a, b) => collator.compare(a.title, b.title)),
    [collections]
  );

  return (
    <aside className="sidebar-column">
      <div className="sidebar-panel">
        <Stack gap="md" h="100%">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Title order={2} c="white">
              {t("app.name")}
            </Title>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={onRefresh}
              loading={refreshing}
              aria-label={t("sidebar.refreshLibrary")}
              style={{ color: "var(--app-sidebar-fg)" }}
            >
              <RefreshCw size={14} />
            </ActionIcon>
          </Group>

          <div className="sidebar-section">
            <div className="sidebar-nav-scroll">
              <Stack gap="lg" mt="sm">
                <SidebarSectionShell
                  title={t("sidebar.collections")}
                  action={
                    <Menu position="bottom-end" withinPortal>
                      <Menu.Target>
                        <SidebarSectionActionButton ariaLabel={t("sidebar.collectionActions")}>
                          <Plus size={16} />
                        </SidebarSectionActionButton>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<Plus size={14} />} onClick={onCreateCollection}>
                          {t("sidebar.newCollection")}
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<FileArchive size={14} />}
                          onClick={onImportCollection}
                        >
                          {t("sidebar.importCollection")}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  }
                >
                  <ScopeButton
                    label={t("sidebar.all")}
                    count={totalSkills}
                    active={selectedScope === "all"}
                    onClick={() => onSelectScope("all")}
                  />
                  {sortedCollections.map((collection) => (
                    <ScopeButton
                      key={collection.id}
                      label={collection.title}
                      count={collection.count}
                      active={selectedScope === `collection:${collection.id}`}
                      onClick={() => onSelectScope(`collection:${collection.id}`)}
                      onRename={() => onRenameCollection(collection)}
                      onDelete={() => onDeleteCollection(collection)}
                      onExport={() => onExportCollection(collection)}
                    />
                  ))}
                </SidebarSectionShell>

                <SidebarSectionShell
                  title={t("sidebar.tools")}
                  action={
                    <SidebarSectionActionButton
                      ariaLabel={t("sidebar.addTool")}
                      onClick={() => onOpenSettings("tools")}
                    >
                      <Plus size={16} />
                    </SidebarSectionActionButton>
                  }
                >
                  {tools.length > 0 ? (
                    tools.map((tool) => (
                      <ScopeButton
                        key={tool.id}
                        label={tool.title}
                        count={tool.count}
                        icon={tool.icon}
                        active={selectedScope === `tool:${tool.id}`}
                        onClick={() => onSelectScope(`tool:${tool.id}`)}
                      />
                    ))
                  ) : (
                    <Text size="xs" c="dimmed">
                      {t("sidebar.noTools")}
                    </Text>
                  )}
                </SidebarSectionShell>
              </Stack>
            </div>
          </div>

          <Group gap="xs" mt="auto">
            {showUpdateAction ? (
              <Tooltip label={updateLabel} withArrow position="top">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={onOpenUpdates}
                  aria-label={updateLabel}
                  style={{ color: "var(--app-sidebar-fg)" }}
                >
                  <ArrowDownToLine size={16} />
                </ActionIcon>
              </Tooltip>
            ) : null}
            <ActionIcon
              variant="subtle"
              size="md"
              onClick={onOpenShortcuts}
              aria-label={t("sidebar.openKeyboardShortcuts")}
              style={{ color: "var(--app-sidebar-fg)" }}
            >
              <Keyboard size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              size="md"
              onClick={() => onOpenSettings("general")}
              aria-label={t("sidebar.openSettings")}
              style={{ color: "var(--app-sidebar-fg)" }}
            >
              <Settings2 size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              size="md"
              onClick={toggleColorScheme}
              aria-label={t("sidebar.toggleColorScheme")}
              style={{ color: "var(--app-sidebar-fg)" }}
            >
              {colorScheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </ActionIcon>
          </Group>
        </Stack>
      </div>
    </aside>
  );
});

function ScopeButton({
  label,
  count,
  active,
  onClick,
  icon,
  onRename,
  onDelete,
  onExport,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon?: ToolIconKey;
  onRename?: () => void;
  onDelete?: () => void;
  onExport?: () => void;
}) {
  const { t } = useAppTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const contextMenu = useContextMenuPosition();
  const hasMenu = Boolean(onRename || onDelete || onExport);
  const handleContextMenu = (event: MouseEvent) => {
    if (!hasMenu) return;
    event.preventDefault();
    contextMenu.capturePosition(event);
    setMenuOpen(true);
  };

  return (
    <div className={active ? "sidebar-scope-row active" : "sidebar-scope-row"}>
      <UnstyledButton
        onClick={onClick}
        onContextMenu={handleContextMenu}
        className="sidebar-scope-button"
      >
        <Group gap={8} wrap="nowrap" className="sidebar-scope-main">
          {icon ? <span className="sidebar-tool-icon">{toolIcon(icon, 13)}</span> : null}
          <Text size="sm" className="sidebar-scope-label">
            {label}
          </Text>
        </Group>
        <Text size="xs" className="sidebar-scope-count">
          {count}
        </Text>
      </UnstyledButton>
      {hasMenu ? (
        <Menu opened={menuOpen} onChange={setMenuOpen} position="bottom-end" withinPortal>
          <Menu.Target>
            <contextMenu.Anchor x={contextMenu.position.x} y={contextMenu.position.y} />
          </Menu.Target>
          <ActionIcon
            variant="subtle"
            size="xs"
            aria-label={t("sidebar.manageCollection", { collection: label })}
            className="sidebar-scope-delete"
            onClick={(event) => {
              contextMenu.capturePosition(event);
              setMenuOpen(true);
            }}
            onContextMenu={handleContextMenu}
          >
            <Ellipsis size={12} />
          </ActionIcon>
          <Menu.Dropdown>
            {onRename ? (
              <Menu.Item leftSection={<Pencil size={14} />} onClick={onRename}>
                {t("sidebar.rename")}
              </Menu.Item>
            ) : null}
            {onExport ? (
              <Menu.Item leftSection={<Download size={14} />} onClick={onExport}>
                {t("sidebar.exportCollection")}
              </Menu.Item>
            ) : null}
            {onDelete ? (
              <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={onDelete}>
                {t("sidebar.delete")}
              </Menu.Item>
            ) : null}
          </Menu.Dropdown>
        </Menu>
      ) : null}
    </div>
  );
}
