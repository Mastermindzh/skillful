import { useCallback } from "react";
import type { GitBackupRestoreMode } from "../../../../shared/types";
import type { SettingsState } from "./useSettingsState";

type LibraryReloaders = {
  activeLibraryItemId: string | null;
  reloadItems: (preferredId?: string) => Promise<string | null>;
  reloadItemsAfterRestore: (preferredId?: string) => Promise<string | null>;
  reloadToolStatuses: (itemId: string) => Promise<void>;
};

/**
 * Settings actions that also refresh the library and tool statuses afterwards. Lives outside
 * `useSettingsState` because the library hooks themselves depend on the loaded settings.
 */
export function useSettingsActions(
  settings: SettingsState,
  {
    activeLibraryItemId,
    reloadItems,
    reloadItemsAfterRestore,
    reloadToolStatuses,
  }: LibraryReloaders
) {
  const { save: saveSettings } = settings.modal;
  const { restore: restoreBackup, setup: setupBackup } = settings.backup;
  const toolMappings = settings.appSettings?.toolMappings;
  /** A saved backup config change is pushed right away so the remote matches what was saved. */
  const syncAfterSave = settings.backup.hasUnsavedChanges && settings.backup.config.enabled;

  const save = useCallback(
    () =>
      saveSettings({
        activeLibraryItemId,
        backupAfterSave: syncAfterSave,
        toolMappings: toolMappings ?? [],
        reloadSkills: reloadItems,
        reloadToolStatuses,
      }),
    [
      activeLibraryItemId,
      reloadItems,
      reloadToolStatuses,
      saveSettings,
      syncAfterSave,
      toolMappings,
    ]
  );

  const restore = useCallback(
    (mode: GitBackupRestoreMode) =>
      restoreBackup({
        activeLibraryItemId,
        mode,
        reloadSkills: reloadItemsAfterRestore,
        reloadToolStatuses,
      }),
    [activeLibraryItemId, reloadItemsAfterRestore, reloadToolStatuses, restoreBackup]
  );

  const setup = useCallback(
    () =>
      setupBackup({
        activeLibraryItemId,
        toolMappings: toolMappings ?? [],
        reloadSkills: reloadItems,
        reloadToolStatuses,
      }),
    [activeLibraryItemId, reloadItems, reloadToolStatuses, setupBackup, toolMappings]
  );

  return { syncAfterSave, save, restore, setup };
}

export type SettingsActions = ReturnType<typeof useSettingsActions>;
