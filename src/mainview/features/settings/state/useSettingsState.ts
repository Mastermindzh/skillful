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
import { useGitLibrarySettingsState } from "./useGitLibrarySettingsState";
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
  const gitLibraries = useGitLibrarySettingsState(appSettings);
  const tools = useToolSettingsState(appSettings);
  const backup = useBackupSettingsState(appSettings);
  const { reset: resetGeneral } = general;
  const { reset: resetLibrary } = library;
  const { reset: resetGitLibraries, refreshStatuses: refreshGitLibraryStatuses } = gitLibraries;
  const { reset: resetTools } = tools;
  const {
    clearTransient: clearBackupTransient,
    resetFromSettings: resetBackup,
    setActionAttempted: setBackupActionAttempted,
    setErrorMessage: setBackupErrorMessage,
    setRestoreNeedsConfirmation: setBackupRestoreNeedsConfirmation,
    setRestoring: setBackupRestoring,
  } = backup;
  const settingsChanged =
    library.dirty || gitLibraries.dirty || tools.dirty || general.dirty || backup.dirty;
  const hasValidationErrors =
    library.validation.hasErrors ||
    gitLibraries.validation.hasErrors ||
    tools.validation.hasErrors ||
    backup.validation.hasErrors;

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const resetRows = useCallback(
    (settings: AppSettings | null) => {
      resetLibrary(settings);
      resetGitLibraries(settings);
      resetTools(settings);
      resetGeneral(settings);
      resetBackup(settings);
    },
    [resetBackup, resetGeneral, resetGitLibraries, resetLibrary, resetTools]
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
      clearBackupTransient();
      resetRows(appSettings);
      void refreshGitLibraryStatuses();
    },
    [appSettings, clearBackupTransient, refreshGitLibraryStatuses, resetRows]
  );

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setSettingsError(null);
    clearBackupTransient();
    resetRows(appSettings);
  }, [appSettings, clearBackupTransient, resetRows]);

  const saveSettings = useCallback(
    async ({
      activeLibraryItemId,
      backupAfterSave = false,
      reloadSkills,
      reloadToolStatuses,
      toolMappings,
    }: SaveSettingsOptions) => {
      if (hasValidationErrors) return;
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
          gitLibraries: gitLibraries.validation.libraries,
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
      general.saveFields,
      gitLibraries.validation.libraries,
      hasValidationErrors,
      library.validation.cleanedRoots,
      resetRows,
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
      setBackupActionAttempted(true);
      if (backup.restoreValidation.hasErrors) return;
      setBackupRestoring(true);
      try {
        const nextSettings = await appRpc.request.restoreGitBackup({
          gitBackup: backup.restoreValidation.config,
          mode,
        });
        setAppSettings(nextSettings);
        resetRows(nextSettings);
        setSuppressSuccessNotifications(nextSettings.suppressSuccessNotifications);
        setBackupErrorMessage(null);
        setSettingsError(null);
        setBackupRestoreNeedsConfirmation(false);
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
          setBackupRestoreNeedsConfirmation(true);
          setBackupErrorMessage(t("settings.backup.error.localContent"));
          return;
        }
        setBackupErrorMessage(
          nextError instanceof Error ? nextError.message : t("settings.backup.error.restore")
        );
      } finally {
        setBackupRestoring(false);
      }
    },
    [
      backup.restoreValidation.config,
      backup.restoreValidation.hasErrors,
      setBackupActionAttempted,
      setBackupErrorMessage,
      setBackupRestoreNeedsConfirmation,
      setBackupRestoring,
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
      setBackupActionAttempted(true);
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
          gitLibraries: gitLibraries.validation.libraries,
        });
        setAppSettings(nextSettings);
        resetRows(nextSettings);
        setSuppressSuccessNotifications(nextSettings.suppressSuccessNotifications);
        setSettingsError(null);
        setBackupErrorMessage(null);
        setBackupRestoreNeedsConfirmation(false);
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
        setBackupErrorMessage(
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
      setBackupActionAttempted,
      setBackupErrorMessage,
      setBackupRestoreNeedsConfirmation,
      general.saveFields,
      gitLibraries.validation.libraries,
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
        library: library.dirty || gitLibraries.dirty,
        tools: tools.dirty,
        backup: backup.dirty,
      },
      errorMessage: settingsError,
      hasChanges: settingsChanged,
      hasValidationErrors,
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
    gitLibraries: {
      addRow: gitLibraries.addRow,
      busyIds: gitLibraries.busyIds,
      discard: gitLibraries.discard,
      dismissHostPrompt: gitLibraries.dismissHostPrompt,
      errorMessage: gitLibraries.errorMessage,
      expandedById: gitLibraries.expandedById,
      hostPrompt: gitLibraries.hostPrompt,
      push: gitLibraries.push,
      refreshStatuses: gitLibraries.refreshStatuses,
      removeRow: gitLibraries.removeRow,
      restoreRow: gitLibraries.restoreRow,
      rows: gitLibraries.rows,
      statusById: gitLibraries.statusById,
      sync: gitLibraries.sync,
      syncAll: gitLibraries.syncAll,
      syncingAll: gitLibraries.syncingAll,
      toggleExpanded: gitLibraries.toggleExpanded,
      trustHost: gitLibraries.trustHost,
      updateRow: gitLibraries.updateRow,
      validation: gitLibraries.validation,
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
