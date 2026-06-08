import { appRpc } from "@mainview-bridge";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppError } from "../../../../shared/errors";
import type {
  AppConfig,
  AppSettings,
  GitBackupRestoreMode,
  GitBackupResult,
} from "../../../../shared/types";
import { useAppTranslation } from "../../../i18n/i18n";
import { setSuppressSuccessNotifications } from "../../notifications/notify";
import { sameScanRoots } from "../model/scanRoots";
import { useBackupSettingsState } from "./useBackupSettingsState";
import { useGeneralSettingsState } from "./useGeneralSettingsState";
import { useLibrarySettingsState } from "./useLibrarySettingsState";
import { useToolSettingsState } from "./useToolSettingsState";

export type SettingsTab = "general" | "library" | "tools" | "backup" | "updates";

type SaveSettingsOptions = {
  activeLibraryItemId: string | null;
  backupAfterSave?: boolean;
  toolMappings: AppConfig["toolMappings"];
  reloadSkills: (preferredId?: string) => Promise<string | null>;
  reloadToolStatuses: (itemId: string) => Promise<void>;
};

type RestoreGitBackupOptions = {
  activeLibraryItemId: string | null;
  mode: GitBackupRestoreMode;
  reloadSkills: (preferredId?: string) => Promise<string | null>;
  reloadToolStatuses: (itemId: string) => Promise<void>;
};

function backupResultSucceeded(result: GitBackupResult) {
  return result.state === "ready" || result.state === "up-to-date";
}

/**
 * Coordinates the settings modal and cross-tab saves. Per-tab editing state lives in
 * sibling settings feature hooks so this file only owns modal flow and persistence.
 */
export function useSettingsState() {
  const { t } = useAppTranslation();
  const tRef = useRef(t);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const general = useGeneralSettingsState(appSettings);
  const library = useLibrarySettingsState(appSettings);
  const tools = useToolSettingsState(appSettings);
  const backup = useBackupSettingsState(appSettings);
  const settingsChanged = library.dirty || tools.dirty || general.dirty || backup.dirty;

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const resetRows = useCallback(
    (settings: AppSettings | null) => {
      library.reset(settings);
      tools.reset(settings);
      general.reset(settings);
      backup.resetFromSettings(settings);
    },
    [backup.resetFromSettings, general.reset, library.reset, tools.reset]
  );

  const loadSettings = useCallback(async () => {
    try {
      const nextSettings = await appRpc.request.getConfig();
      setAppSettings(nextSettings);
      resetRows(nextSettings);
      setSuppressSuccessNotifications(nextSettings.suppressSuccessNotifications);
      setSettingsError(null);
      return nextSettings;
    } catch (nextError) {
      setSettingsError(
        nextError instanceof Error ? nextError.message : tRef.current("common.error.loadSettings")
      );
      return null;
    }
  }, [resetRows]);

  const openSettings = useCallback(
    (tab: SettingsTab = "general") => {
      setSettingsOpen(true);
      setSettingsTab(tab);
      setSettingsError(null);
      backup.clearTransient();
      resetRows(appSettings);
    },
    [appSettings, backup.clearTransient, resetRows]
  );

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setSettingsError(null);
    backup.clearTransient();
    resetRows(appSettings);
  }, [appSettings, backup.clearTransient, resetRows]);

  const saveSettings = useCallback(
    async ({
      activeLibraryItemId,
      backupAfterSave = false,
      reloadSkills,
      reloadToolStatuses,
      toolMappings,
    }: SaveSettingsOptions) => {
      if (library.validation.hasErrors || tools.validation.hasErrors || backup.validation.hasErrors)
        return;
      setSettingsSaving(true);
      try {
        const scanRootsChanged = !sameScanRoots(
          library.validation.cleanedRoots,
          appSettings?.scanRoots ?? []
        );
        const nextSettings = await appRpc.request.saveConfig({
          scanRoots: library.validation.cleanedRoots,
          tools: tools.validation.tools,
          toolMappings,
          ...general.saveFields,
          onboardingTourCompleted: appSettings?.onboardingTourCompleted ?? false,
          gitBackup: backup.validation.config,
        });
        setAppSettings(nextSettings);
        resetRows(nextSettings);
        setSuppressSuccessNotifications(nextSettings.suppressSuccessNotifications);
        setSettingsError(null);
        if (scanRootsChanged) {
          await reloadSkills(activeLibraryItemId ?? undefined);
        }
        if (activeLibraryItemId) {
          await reloadToolStatuses(activeLibraryItemId);
        }
        if (backupAfterSave) {
          const result = await appRpc.request.runGitBackup();
          if (!backupResultSucceeded(result)) {
            throw new Error(result.message || t("settings.backup.error.run"));
          }
        }
        setSettingsOpen(false);
      } catch (nextError) {
        setSettingsError(
          nextError instanceof Error ? nextError.message : t("common.error.saveSettings")
        );
      } finally {
        setSettingsSaving(false);
      }
    },
    [
      appSettings?.onboardingTourCompleted,
      appSettings?.scanRoots,
      backup.validation.config,
      backup.validation.hasErrors,
      general.saveFields,
      library.validation.cleanedRoots,
      library.validation.hasErrors,
      resetRows,
      tools.validation.hasErrors,
      tools.validation.tools,
      t,
    ]
  );

  const restoreGitBackup = useCallback(
    async ({
      activeLibraryItemId,
      mode,
      reloadSkills,
      reloadToolStatuses,
    }: RestoreGitBackupOptions) => {
      backup.setActionAttempted(true);
      if (backup.restoreValidation.hasErrors) return;
      backup.setRestoring(true);
      try {
        const nextSettings = await appRpc.request.restoreGitBackup({
          gitBackup: backup.restoreValidation.config,
          mode,
        });
        setAppSettings(nextSettings);
        resetRows(nextSettings);
        setSuppressSuccessNotifications(nextSettings.suppressSuccessNotifications);
        backup.setErrorMessage(null);
        setSettingsError(null);
        backup.setRestoreNeedsConfirmation(false);
        const nextActiveLibraryItemId = await reloadSkills(activeLibraryItemId ?? undefined);
        if (nextActiveLibraryItemId) {
          await reloadToolStatuses(nextActiveLibraryItemId);
        }
      } catch (nextError) {
        if (
          nextError instanceof AppError &&
          nextError.code === "git-restore-local-content" &&
          mode === "safe"
        ) {
          backup.setRestoreNeedsConfirmation(true);
          backup.setErrorMessage(t("settings.backup.error.localContent"));
          return;
        }
        backup.setErrorMessage(
          nextError instanceof Error ? nextError.message : t("settings.backup.error.restore")
        );
      } finally {
        backup.setRestoring(false);
      }
    },
    [
      backup.restoreValidation.config,
      backup.restoreValidation.hasErrors,
      backup.setActionAttempted,
      backup.setErrorMessage,
      backup.setRestoreNeedsConfirmation,
      backup.setRestoring,
      resetRows,
      t,
    ]
  );

  const setupGitBackup = useCallback(
    async ({
      activeLibraryItemId,
      reloadSkills,
      reloadToolStatuses,
      toolMappings,
    }: SaveSettingsOptions) => {
      backup.setActionAttempted(true);
      if (
        library.validation.hasErrors ||
        tools.validation.hasErrors ||
        backup.restoreValidation.hasErrors
      )
        return;
      setSettingsSaving(true);
      try {
        const scanRootsChanged = !sameScanRoots(
          library.validation.cleanedRoots,
          appSettings?.scanRoots ?? []
        );
        const nextSettings = await appRpc.request.saveConfig({
          scanRoots: library.validation.cleanedRoots,
          tools: tools.validation.tools,
          toolMappings,
          ...general.saveFields,
          onboardingTourCompleted: appSettings?.onboardingTourCompleted ?? false,
          gitBackup: {
            ...backup.restoreValidation.config,
            enabled: true,
          },
        });
        setAppSettings(nextSettings);
        resetRows(nextSettings);
        setSuppressSuccessNotifications(nextSettings.suppressSuccessNotifications);
        setSettingsError(null);
        backup.setErrorMessage(null);
        backup.setRestoreNeedsConfirmation(false);
        if (scanRootsChanged) {
          await reloadSkills(activeLibraryItemId ?? undefined);
        }
        if (activeLibraryItemId) {
          await reloadToolStatuses(activeLibraryItemId);
        }
        const result = await appRpc.request.runGitBackup();
        if (!backupResultSucceeded(result)) {
          throw new Error(result.message || t("settings.backup.error.run"));
        }
      } catch (nextError) {
        backup.setErrorMessage(
          nextError instanceof Error ? nextError.message : t("settings.backup.error.run")
        );
      } finally {
        setSettingsSaving(false);
      }
    },
    [
      appSettings?.onboardingTourCompleted,
      appSettings?.scanRoots,
      backup.restoreValidation.config,
      backup.restoreValidation.hasErrors,
      backup.setActionAttempted,
      backup.setErrorMessage,
      backup.setRestoreNeedsConfirmation,
      general.saveFields,
      library.validation.cleanedRoots,
      library.validation.hasErrors,
      resetRows,
      tools.validation.hasErrors,
      tools.validation.tools,
      t,
    ]
  );

  return {
    appSettings,
    loadSettings,
    setAppSettings,
    modal: {
      activeTab: settingsTab,
      close: closeSettings,
      dirtyTabs: {
        general: general.dirty,
        library: library.dirty,
        tools: tools.dirty,
        backup: backup.dirty,
      },
      errorMessage: settingsError,
      hasChanges: settingsChanged,
      hasValidationErrors:
        library.validation.hasErrors || tools.validation.hasErrors || backup.validation.hasErrors,
      open: openSettings,
      opened: settingsOpen,
      save: saveSettings,
      saving: settingsSaving,
      setActiveTab: setSettingsTab,
    },
    library: {
      addRow: library.addRow,
      rows: library.rows,
      updateRow: library.updateRow,
      removeRow: library.removeRow,
      restoreRow: library.restoreRow,
      validation: library.validation,
    },
    general: {
      defaultEditorMode: general.defaultEditorMode,
      language: general.language,
      minimizeToTrayOnClose: general.minimizeToTrayOnClose,
      setMinimizeToTrayOnClose: general.setMinimizeToTrayOnClose,
      setDefaultEditorMode: general.setDefaultEditorMode,
      setLanguage: general.setLanguage,
      suppressSuccessNotifications: general.suppressSuccessNotifications,
      setSuppressSuccessNotifications: general.setSuppressSuccessNotifications,
    },
    tools: {
      addPreset: tools.addPreset,
      addRow: tools.addRow,
      activeRowId: tools.activeRowId,
      availablePresets: tools.availablePresets,
      pickInstallFolder: tools.pickInstallFolder,
      removeRow: tools.removeRow,
      restoreRow: tools.restoreRow,
      rows: tools.rows,
      setActiveRowId: tools.setActiveRowId,
      updateRow: tools.updateRow,
      validation: tools.validation,
    },
    backup: {
      config: backup.config,
      configured: backup.configured,
      errorMessage: backup.errorMessage,
      hasUnsavedChanges: backup.dirty,
      issue: backup.issue,
      actionIssue: backup.actionIssue,
      restore: restoreGitBackup,
      restoreHasValidationErrors: backup.restoreHasValidationErrors,
      restoreNeedsConfirmation: backup.restoreNeedsConfirmation,
      restoring: backup.restoring,
      reset: backup.reset,
      setup: setupGitBackup,
      updateConfig: backup.updateConfig,
    },
  };
}
