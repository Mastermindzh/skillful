import { useEffect } from "react";

type AppShortcutHandlers = {
  enabled: boolean;
  canCreateItem: boolean;
  canDeleteItem: boolean;
  canRenameItem: boolean;
  onCreateItem: () => void;
  onDeleteItem: () => void;
  onFocusSearch: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onRefreshLibrary: () => void;
  onRenameItem: () => void;
};

export function useAppShortcuts({
  enabled,
  canCreateItem,
  canDeleteItem,
  canRenameItem,
  onCreateItem,
  onDeleteItem,
  onFocusSearch,
  onOpenSettings,
  onOpenShortcuts,
  onRefreshLibrary,
  onRenameItem,
}: AppShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;

      const usesModifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (usesModifier && key === "f") {
        event.preventDefault();
        onFocusSearch();
        return;
      }

      if (usesModifier && event.key === ",") {
        event.preventDefault();
        onOpenSettings();
        return;
      }

      if (usesModifier && key === "r") {
        event.preventDefault();
        onRefreshLibrary();
        return;
      }

      if (usesModifier && key === "n" && canCreateItem) {
        event.preventDefault();
        onCreateItem();
        return;
      }

      if (isEditableTarget(event.target)) return;

      if (event.shiftKey && (event.key === "?" || event.key === "/")) {
        event.preventDefault();
        onOpenShortcuts();
        return;
      }

      if (event.key === "F2" && canRenameItem) {
        event.preventDefault();
        onRenameItem();
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && canDeleteItem) {
        event.preventDefault();
        onDeleteItem();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    enabled,
    canCreateItem,
    canDeleteItem,
    canRenameItem,
    onCreateItem,
    onDeleteItem,
    onFocusSearch,
    onOpenSettings,
    onOpenShortcuts,
    onRefreshLibrary,
    onRenameItem,
  ]);
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], .cm-content"));
}
