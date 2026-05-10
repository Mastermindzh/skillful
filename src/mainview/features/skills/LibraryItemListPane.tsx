import {
  ActionIcon,
  Badge,
  Group,
  Menu,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Ellipsis, FolderInput, FolderOpen, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { LibraryItemSummary } from "../../../shared/types";
import { EmptyState } from "../../components/EmptyState";
import { useContextMenuPosition } from "../../components/useContextMenuPosition";
import { useAppTranslation } from "../../i18n/i18n";
import { logRendererPerf } from "../../performance";
import { LibraryKindBadge } from "../library/LibraryKindBadge";
import type { LibraryKindFilter } from "./libraryItems";

/**
 * Initial height estimate per row in the virtualized list. Actual heights vary
 * because descriptions line-clamp to 2 lines, so we also pass `measureElement`
 * to the virtualizer; this constant just gets us a reasonable first paint.
 */
const ROW_HEIGHT_ESTIMATE = 68;
/** Extra rows rendered above/below the viewport for smoother scrolling. */
const ROW_OVERSCAN = 8;

export type LibraryItemListPermissions = {
  canCreate: boolean;
  canRename: boolean;
  canDelete: boolean;
  canReveal: boolean;
  canMove: boolean;
};

type LibraryItemListPaneProps = {
  libraryItems: LibraryItemSummary[];
  selectedId: string | null;
  query: string;
  title: string;
  focusSearchToken: number;
  kindFilter: LibraryKindFilter;
  permissions: LibraryItemListPermissions;
  /**
   * When true, render a small dimmed collection name under each item's title.
   * Use this for scopes that can include items from more than one collection
   * (e.g. "All items" or a tool view that spans collections).
   */
  showItemCollections: boolean;
  /** Lookup of collection id -> display title, used when {@link showItemCollections} is true. */
  collectionTitleById: ReadonlyMap<string, string>;
  onKindFilterChange: (value: LibraryKindFilter) => void;
  onCreateSkill: () => void;
  onRenameSkill: (item: LibraryItemSummary) => void;
  onMoveSkill: (item: LibraryItemSummary) => void;
  onDeleteSkill: (item: LibraryItemSummary) => void;
  onRevealSkill: (item: LibraryItemSummary) => void;
  onQueryChange: (value: string) => void;
  onSelectSkill: (id: string | null) => void;
  onFocusEditor: () => void;
};

export function LibraryItemListPane({
  libraryItems,
  selectedId,
  query,
  title,
  focusSearchToken,
  kindFilter,
  permissions,
  showItemCollections,
  collectionTitleById,
  onKindFilterChange,
  onCreateSkill,
  onRenameSkill,
  onMoveSkill,
  onDeleteSkill,
  onRevealSkill,
  onQueryChange,
  onSelectSkill,
  onFocusEditor,
}: LibraryItemListPaneProps) {
  const { t } = useAppTranslation();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const selectedIndex = selectedId ? libraryItems.findIndex((item) => item.id === selectedId) : -1;
  const selectedItem = selectedIndex >= 0 ? libraryItems[selectedIndex] : null;
  const { canCreate, canRename, canDelete, canReveal, canMove } = permissions;

  const rowVirtualizer = useVirtualizer({
    count: libraryItems.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: ROW_OVERSCAN,
    getItemKey: (index) => libraryItems[index]?.id ?? index,
  });

  useEffect(() => {
    if (selectedIndex < 0) return;
    rowVirtualizer.scrollToIndex(selectedIndex, { align: "auto" });
  }, [rowVirtualizer, selectedIndex]);

  useEffect(() => {
    if (focusSearchToken === 0) return;
    searchRef.current?.focus();
    searchRef.current?.select();
  }, [focusSearchToken]);

  useEffect(() => {
    logRendererPerf("renderer.libraryItemList.visible", {
      title,
      items: libraryItems.length,
      kindFilter,
      queryLength: query.trim().length,
    });
  }, [kindFilter, libraryItems.length, query, title]);

  const handleListKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (libraryItems.length === 0) return;

      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        onSelectSkill(
          libraryItems[Math.min(currentIndex + 1, libraryItems.length - 1)]?.id ?? null
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        onSelectSkill(libraryItems[Math.max(currentIndex - 1, 0)]?.id ?? null);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        onSelectSkill(libraryItems[0]?.id ?? null);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        onSelectSkill(libraryItems[libraryItems.length - 1]?.id ?? null);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        onFocusEditor();
      }
    },
    [onFocusEditor, onSelectSkill, selectedIndex, libraryItems]
  );

  return (
    <section className="split-pane list-pane">
      <Stack gap="sm" className="column-stack">
        <Group
          justify="space-between"
          align="flex-start"
          wrap="nowrap"
          className="list-pane-header"
        >
          <div className="list-pane-heading-copy">
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">
              {t("library.heading")}
            </Text>
            <Title order={4} mt={2}>
              {title}
            </Title>
          </div>
          <Group gap="xs" wrap="nowrap" className="list-pane-header-actions">
            <Badge color="gray" variant="light" className="list-pane-count-badge">
              {libraryItems.length}
            </Badge>
            <Tooltip
              label={canCreate ? t("library.createItem") : t("library.createCollectionFirst")}
              openDelay={500}
            >
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={(event) => {
                  if (!canCreate) {
                    event.preventDefault();
                    return;
                  }
                  onCreateSkill();
                }}
                aria-label={
                  canCreate ? t("library.createItem") : t("library.createCollectionFirst")
                }
                aria-disabled={!canCreate}
                data-disabled={!canCreate}
              >
                <Plus size={15} />
              </ActionIcon>
            </Tooltip>
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  aria-label={t("library.manageSelectedItem")}
                  disabled={!canReveal && !canRename && !canMove && !canDelete}
                >
                  <Ellipsis size={15} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<FolderOpen size={14} />}
                  onClick={() => selectedItem && onRevealSkill(selectedItem)}
                  disabled={!canReveal || !selectedItem}
                >
                  {t("common.openContainingFolder")}
                </Menu.Item>
                <Menu.Item
                  leftSection={<Pencil size={14} />}
                  onClick={() => selectedItem && onRenameSkill(selectedItem)}
                  disabled={!canRename || !selectedItem}
                >
                  {t("common.renameSelected")}
                </Menu.Item>
                <Menu.Item
                  leftSection={<FolderInput size={14} />}
                  onClick={() => selectedItem && onMoveSkill(selectedItem)}
                  disabled={!canMove || !selectedItem}
                >
                  {t("common.moveSelected")}
                </Menu.Item>
                <Menu.Item
                  color="red"
                  leftSection={<Trash2 size={14} />}
                  onClick={() => selectedItem && onDeleteSkill(selectedItem)}
                  disabled={!canDelete || !selectedItem}
                >
                  {t("common.deleteSelected")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
        <SegmentedControl
          fullWidth
          size="xs"
          value={kindFilter}
          onChange={(value) => onKindFilterChange(value as LibraryKindFilter)}
          data={[
            { label: t("library.kind.all"), value: "all" },
            { label: t("library.kind.skills"), value: "skill" },
            { label: t("library.kind.agents"), value: "agent" },
          ]}
        />
        <TextInput
          ref={searchRef}
          placeholder={t("library.searchItems")}
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          leftSection={<Search size={16} />}
          rightSection={
            query ? (
              <ActionIcon
                variant="subtle"
                size="sm"
                aria-label={t("library.clearSearch")}
                onClick={() => {
                  onQueryChange("");
                  searchRef.current?.focus();
                }}
              >
                <X size={14} />
              </ActionIcon>
            ) : null
          }
        />
        <div
          ref={listRef}
          role="listbox"
          tabIndex={0}
          aria-label={t("library.itemsAriaLabel", { title })}
          aria-activedescendant={selectedId ? `library-item-option-${selectedId}` : undefined}
          className="item-list-scroll item-list-scrollable"
          onKeyDown={handleListKeyDown}
        >
          {libraryItems.length > 0 ? (
            <div
              className="item-list-virtual"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = libraryItems[virtualRow.index];
                if (!item) return null;
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="item-list-virtual-row"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <LibraryItemRow
                      item={item}
                      selected={item.id === selectedId}
                      canReveal={canReveal}
                      canRename={canRename}
                      canMove={canMove}
                      canDelete={canDelete}
                      collectionLabel={
                        showItemCollections
                          ? (collectionTitleById.get(item.collectionId) ?? null)
                          : null
                      }
                      onRevealSkill={onRevealSkill}
                      onRenameSkill={onRenameSkill}
                      onMoveSkill={onMoveSkill}
                      onDeleteSkill={onDeleteSkill}
                      onSelectSkill={onSelectSkill}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              className="item-list-empty"
              title={t("library.empty.title")}
              message={t("library.empty.message")}
            />
          )}
        </div>
      </Stack>
    </section>
  );
}

const LibraryItemRow = memo(function LibraryItemRow({
  canDelete,
  canMove,
  canRename,
  canReveal,
  collectionLabel,
  item,
  onDeleteSkill,
  onMoveSkill,
  onRenameSkill,
  onRevealSkill,
  selected,
  onSelectSkill,
}: {
  canDelete: boolean;
  canMove: boolean;
  canRename: boolean;
  canReveal: boolean;
  collectionLabel: string | null;
  item: LibraryItemSummary;
  onDeleteSkill: (item: LibraryItemSummary) => void;
  onMoveSkill: (item: LibraryItemSummary) => void;
  onRenameSkill: (item: LibraryItemSummary) => void;
  onRevealSkill: (item: LibraryItemSummary) => void;
  selected: boolean;
  onSelectSkill: (id: string) => void;
}) {
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
      <UnstyledButton
        id={`library-item-option-${item.id}`}
        role="option"
        aria-selected={selected}
        onClick={() => onSelectSkill(item.id)}
        onContextMenu={(event) => {
          event.preventDefault();
          contextMenu.capturePosition(event);
          allowContextMenuOpen.current = true;
          onSelectSkill(item.id);
          setContextMenuOpen(true);
          window.setTimeout(() => {
            allowContextMenuOpen.current = false;
          }, 0);
        }}
        data-library-item-id={item.id}
        className={selected ? "item-list-row selected" : "item-list-row"}
      >
        <div className="item-list-row-content">
          <div className="library-item-copy">
            <Text fw={600} size="sm" truncate title={item.title}>
              {item.title}
            </Text>
            {collectionLabel ? (
              <Text
                size="xs"
                fw={600}
                c="primary"
                truncate
                className="library-item-collection"
                title={collectionLabel}
              >
                {collectionLabel}
              </Text>
            ) : null}
            {item.description ? (
              <Text size="xs" c="dimmed" lineClamp={2}>
                {item.description}
              </Text>
            ) : null}
          </div>
          <LibraryKindBadge kind={item.kind} size="xs" />
        </div>
      </UnstyledButton>
      {contextMenuOpen ? (
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<FolderOpen size={14} />}
            onClick={() => onRevealSkill(item)}
            disabled={!canReveal}
          >
            {t("common.openContainingFolder")}
          </Menu.Item>
          <Menu.Item
            leftSection={<Pencil size={14} />}
            onClick={() => onRenameSkill(item)}
            disabled={!canRename}
          >
            {t("common.renameSelected")}
          </Menu.Item>
          <Menu.Item
            leftSection={<FolderInput size={14} />}
            onClick={() => onMoveSkill(item)}
            disabled={!canMove}
          >
            {t("common.moveSelected")}
          </Menu.Item>
          <Menu.Item
            color="red"
            leftSection={<Trash2 size={14} />}
            onClick={() => onDeleteSkill(item)}
            disabled={!canDelete}
          >
            {t("common.deleteSelected")}
          </Menu.Item>
        </Menu.Dropdown>
      ) : null}
    </Menu>
  );
});
