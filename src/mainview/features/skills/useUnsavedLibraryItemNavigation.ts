import { useCallback, useMemo, useState } from "react";
import type { EditorViewMode, LibraryItemDocument } from "../../../shared/types";
import { clearDraftsForLibraryItem, type DraftMap, dirtyFilesForDocument } from "../editor/drafts";

type UseUnsavedSkillNavigationOptions = {
  activeLibraryItem: LibraryItemDocument | null;
  activeLibraryItemId: string | null;
  draftsByFile: DraftMap;
  defaultEditorMode: EditorViewMode;
  saveAllFiles: () => Promise<boolean>;
  setActiveSkillId: (id: string | null) => void;
  setDraftsByFile: (updater: (drafts: DraftMap) => DraftMap) => void;
  setViewMode: (mode: EditorViewMode) => void;
};

type SaveThenNavigateEffects = {
  saveAllFiles: () => Promise<boolean>;
  clearDrafts: () => void;
  navigate: () => void;
};

/**
 * Clears drafts and navigates only after the save succeeds. A failed save must leave both alone,
 * otherwise the dialog that promised to persist the edits is what destroys them.
 */
export async function saveThenNavigate({
  saveAllFiles,
  clearDrafts,
  navigate,
}: SaveThenNavigateEffects) {
  if (!(await saveAllFiles())) return false;
  clearDrafts();
  navigate();
  return true;
}

export function useUnsavedLibraryItemNavigation({
  activeLibraryItem,
  activeLibraryItemId,
  draftsByFile,
  defaultEditorMode,
  saveAllFiles,
  setActiveSkillId,
  setDraftsByFile,
  setViewMode,
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
      setViewMode(defaultEditorMode);
      setActiveSkillId(nextId);
    },
    [activeLibraryItemId, defaultEditorMode, hasUnsavedChanges, setViewMode, setActiveSkillId]
  );

  /** Save all dirty files and navigate to the pending skill. */
  const confirmSaveAndNavigate = useCallback(async () => {
    setUnsavedDialogOpen(false);
    await saveThenNavigate({
      saveAllFiles,
      clearDrafts: () => {
        if (!activeLibraryItem) return;
        setDraftsByFile((drafts) => clearDraftsForLibraryItem(activeLibraryItem.item.id, drafts));
      },
      navigate: () => {
        setViewMode(defaultEditorMode);
        setActiveSkillId(pendingSkillId);
      },
    });
    setPendingSkillId(null);
  }, [
    activeLibraryItem,
    defaultEditorMode,
    pendingSkillId,
    setViewMode,
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
    setViewMode(defaultEditorMode);
    setActiveSkillId(pendingSkillId);
    setPendingSkillId(null);
  }, [
    activeLibraryItem,
    defaultEditorMode,
    pendingSkillId,
    setViewMode,
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
