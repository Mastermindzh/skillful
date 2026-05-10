import { ActionIcon, Group, Menu, Text, Title, Tooltip } from "@mantine/core";
import { ChevronDown, Eye, Pencil, Save } from "lucide-react";
import type { ReactNode } from "react";
import type { EditorViewMode, LibraryItemFile, LibraryItemSummary } from "../../../shared/types";
import { useAppTranslation } from "../../i18n/i18n";
import { LibraryKindBadge } from "../library/LibraryKindBadge";
import { visibleFileLabel } from "../skills/libraryItems";

type LibraryItemDetailsHeaderProps = {
  libraryItem: LibraryItemSummary;
  collectionTitle: string | null;
  activeFile: LibraryItemFile | null;
  viewMode: EditorViewMode;
  onViewModeChange: (value: EditorViewMode) => void;
  compactActions: boolean | undefined;
  saving: boolean;
  canSaveCurrent: boolean;
  canSaveAll: boolean;
  onSaveCurrent: () => void;
  onSaveAll: () => void;
  actionsSlot?: ReactNode;
};

export function LibraryItemDetailsHeader({
  libraryItem,
  collectionTitle,
  activeFile,
  viewMode,
  onViewModeChange,
  compactActions: _compactActions,
  saving,
  canSaveCurrent,
  canSaveAll,
  onSaveCurrent,
  onSaveAll,
  actionsSlot,
}: LibraryItemDetailsHeaderProps) {
  const { t } = useAppTranslation();
  const toggleLabel = viewMode === "preview" ? t("details.edit") : t("details.preview");
  const saveCurrentLabel = t("details.saveFile", {
    file: activeFile ? visibleFileLabel(activeFile) : t("details.fileFallback"),
  });
  return (
    <div className="editor-toolbar">
      <div className="editor-toolbar-copy">
        <Group gap="xs" wrap="nowrap" align="center" mb={2}>
          <Title order={3}>{libraryItem.title}</Title>
          <LibraryKindBadge kind={libraryItem.kind} />
        </Group>
        {collectionTitle ? (
          <Text size="xs" c="dimmed" mt={2} mb={6} className="editor-toolbar-collection">
            {t("library.inCollectionPrefix")} <em>{collectionTitle}</em>
          </Text>
        ) : null}
        <Text
          mt="xs"
          size="sm"
          c="dimmed"
          className="editor-toolbar-description"
          title={libraryItem.description || undefined}
        >
          {libraryItem.description || t("details.noDescription")}
        </Text>
      </div>
      <Group gap="xs" wrap="nowrap" className="editor-actions">
        {actionsSlot}
        {activeFile ? (
          <Tooltip label={toggleLabel} withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              className="editor-view-toggle"
              aria-label={toggleLabel}
              onClick={() => onViewModeChange(viewMode === "preview" ? "edit" : "preview")}
            >
              {viewMode === "preview" ? <Pencil size={16} /> : <Eye size={16} />}
            </ActionIcon>
          </Tooltip>
        ) : null}
        <Group gap={0} wrap="nowrap" className="editor-save-split">
          <ActionIcon
            variant="filled"
            size="lg"
            loading={saving}
            disabled={!canSaveAll && !canSaveCurrent}
            onClick={onSaveAll}
            aria-label={t("details.saveAll")}
            title={t("details.saveAll")}
            className="editor-save-split-main"
          >
            <Save size={16} />
          </ActionIcon>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                variant="filled"
                size="lg"
                aria-label={t("details.saveOptions")}
                disabled={!canSaveAll && !canSaveCurrent}
                className="editor-save-split-chevron"
              >
                <ChevronDown size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<Save size={14} />}
                onClick={onSaveAll}
                disabled={!canSaveAll}
              >
                {t("details.saveAll")}
              </Menu.Item>
              <Menu.Item
                leftSection={<Save size={14} />}
                onClick={onSaveCurrent}
                disabled={!canSaveCurrent}
              >
                {saveCurrentLabel}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </div>
  );
}
