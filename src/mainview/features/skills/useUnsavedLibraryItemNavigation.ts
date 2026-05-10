import { useCallback, useMemo, useState } from "react";
import type { EditorViewMode, LibraryItemDocument } from "../../../shared/types";
import { clearDraftsForLibraryItem, type DraftMap, dirtyFilesForDocument } from "../editor/drafts";
import type { ViewMode } from "./useLibraryItemViewModeIntent";

type UseUnsavedSkillNavigationOptions = {
  activeLibraryItem: LibraryItemDocument | null;
  activeLibraryItemId: string | null;
  draftsByFile: DraftMap;
  defaultEditorMode: EditorViewMode;
  saveAllFiles: () => Promise<void>;
  setActiveSkillId: (id: string | null) => void;
  setDraftsByFile: (updater: (drafts: DraftMap) => DraftMap) => void;
  pushViewModeIntent: (mode: ViewMode) => void;
};

export function useUnsavedLibraryItemNavigation({
  activeLibraryItem,
  activeLibraryItemId,
  draftsByFile,
  defaultEditorMode,
  saveAllFiles,
  setActiveSkillId,
  setDraftsByFile,
  pushViewModeIntent,
}: UseUnsavedSkillNavigationOptions) {
  const [pendingSkillId, setPendingSkillId] = useState<string | null>(null);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);

  const hasUnsavedChanges = useMemo(
    () => dirtyFilesForDocument(activeLibraryItem, draftsByFile).length > 0,
    [activeLibraryItem, draftsByFile]
  );

  /** Gated skill switch: prompts to save if there are unsaved changes. */
  const requestSkillChange = useCallback(
    (nextId: string | null) => {
      if (nextId === activeLibraryItemId) return;
      if (hasUnsavedChanges) {
        setPendingSkillId(nextId);
        setUnsavedDialogOpen(true);
        return;
      }
      pushViewModeIntent(defaultEditorMode);
      setActiveSkillId(nextId);
    },
    [
      activeLibraryItemId,
      defaultEditorMode,
      hasUnsavedChanges,
      pushViewModeIntent,
      setActiveSkillId,
    ]
  );

  /** Save all dirty files and navigate to the pending skill. */
  const confirmSaveAndNavigate = useCallback(async () => {
    setUnsavedDialogOpen(false);
    await saveAllFiles();
    if (activeLibraryItem) {
      setDraftsByFile((drafts) => clearDraftsForLibraryItem(activeLibraryItem.item.id, drafts));
    }
    pushViewModeIntent(defaultEditorMode);
    setActiveSkillId(pendingSkillId);
    setPendingSkillId(null);
  }, [
    activeLibraryItem,
    defaultEditorMode,
    pendingSkillId,
    pushViewModeIntent,
    saveAllFiles,
    setActiveSkillId,
    setDraftsByFile,
  ]);

  /** Discard drafts and navigate to the pending skill. */
  const discardAndNavigate = useCallback(() => {
    setUnsavedDialogOpen(false);
    if (activeLibraryItem) {
      setDraftsByFile((drafts) => clearDraftsForLibraryItem(activeLibraryItem.item.id, drafts));
    }
    pushViewModeIntent(defaultEditorMode);
    setActiveSkillId(pendingSkillId);
    setPendingSkillId(null);
  }, [
    activeLibraryItem,
    defaultEditorMode,
    pendingSkillId,
    pushViewModeIntent,
    setActiveSkillId,
    setDraftsByFile,
  ]);

  /** Cancel the pending navigation. */
  const cancelNavigation = useCallback(() => {
    setUnsavedDialogOpen(false);
    setPendingSkillId(null);
  }, []);

  return {
    cancelNavigation,
    confirmSaveAndNavigate,
    discardAndNavigate,
    hasUnsavedChanges,
    requestSkillChange,
    unsavedDialogOpen,
  };
}
