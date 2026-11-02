import type { SettingsActions } from "../state/useSettingsActions";
import type { SettingsState } from "../state/useSettingsState";
import type { UpdaterState } from "../state/useUpdaterState";
import { SettingsModal } from "./SettingsModal";

type AppSettingsModalProps = {
  settings: SettingsState;
  actions: SettingsActions;
  updater: UpdaterState;
  onEditInstructions: (toolId: string) => void;
};

/** Connects the settings and updater state to the settings modal's panels. */
export function AppSettingsModal({
  settings,
  actions,
  updater,
  onEditInstructions,
}: AppSettingsModalProps) {
  const { appSettings, general, library, gitLibraries, tools, backup, modal } = settings;
  const platform = appSettings?.platform;
  return (
    <SettingsModal
      opened={modal.opened}
      activeTab={modal.activeTab}
      general={{
        defaultEditorMode: general.defaultEditorMode,
        onDefaultEditorModeChange: general.setDefaultEditorMode,
        language: general.language,
        onLanguageChange: general.setLanguage,
        suppressSuccessNotifications: general.suppressSuccessNotifications,
        onSuppressSuccessNotificationsChange: general.setSuppressSuccessNotifications,
        minimizeToTrayOnClose: general.minimizeToTrayOnClose,
        onMinimizeToTrayOnCloseChange: general.setMinimizeToTrayOnClose,
      }}
      library={{
        scanRoots: library.rows,
        defaultScanRoot: appSettings?.defaultScanRoot ?? "",
        platform,
        validationById: library.validation.byId,
        onScanRootChange: library.updateRow,
        onAddScanRoot: library.addRow,
        onRemoveScanRoot: library.removeRow,
        onRestoreScanRoot: library.restoreRow,
      }}
      gitLibraries={{
        rows: gitLibraries.rows,
        platform,
        issueById: gitLibraries.validation.issueById,
        statusById: gitLibraries.statusById,
        libraryPaths: appSettings?.gitLibraryPaths ?? {},
        defaultRoot: appSettings?.defaultGitLibraryRoot ?? "",
        busyIds: gitLibraries.busyIds,
        errorMessage: gitLibraries.errorMessage,
        hostPrompt: gitLibraries.hostPrompt,
        expandedById: gitLibraries.expandedById,
        onToggleExpanded: gitLibraries.toggleExpanded,
        onAddRow: gitLibraries.addRow,
        onUpdateRow: gitLibraries.updateRow,
        onRemoveRow: gitLibraries.removeRow,
        onRestoreRow: gitLibraries.restoreRow,
        onSync: gitLibraries.sync,
        onPush: gitLibraries.push,
        onDiscard: gitLibraries.discard,
        onTrustHost: gitLibraries.trustHost,
        onDismissHostPrompt: gitLibraries.dismissHostPrompt,
      }}
      tools={{
        tools: tools.rows,
        platform,
        validationById: tools.validation.byId,
        availablePresets: tools.availablePresets,
        onToolChange: tools.updateRow,
        onPickInstallFolder: tools.pickInstallFolder,
        onAddTool: tools.addRow,
        onAddPreset: tools.addPreset,
        onRemoveTool: tools.removeRow,
        onRestoreTool: tools.restoreRow,
        activeRowId: tools.activeRowId,
        onActiveRowChange: tools.setActiveRowId,
        onEditInstructions,
      }}
      backup={{
        config: backup.config,
        configured: backup.configured,
        issue: backup.configured ? backup.issue : backup.actionIssue,
        errorMessage: backup.errorMessage,
        restoreDisabled: backup.restoreHasValidationErrors || modal.saving,
        restoreNeedsConfirmation: backup.restoreNeedsConfirmation,
        restoring: backup.restoring,
        onConfigChange: backup.updateConfig,
        onReset: backup.reset,
        onRestore: (mode) => void actions.restore(mode),
        onSetup: () => void actions.setup(),
      }}
      updates={{
        updateState: updater.updateState,
        loading: updater.loading,
        checking: updater.checking,
        downloading: updater.downloading,
        applying: updater.applying,
        errorMessage: updater.errorMessage,
        onCheckForUpdates: () => void updater.checkForUpdates(),
        onDownloadUpdate: () => void updater.downloadUpdate(),
        onApplyUpdate: () => void updater.applyUpdate(),
      }}
      footer={{
        hasChanges: modal.hasChanges,
        saving: modal.saving,
        errorMessage: modal.errorMessage,
        syncAfterSave: actions.syncAfterSave,
        onClose: modal.close,
        onSave: () => void actions.save(),
      }}
      onTabChange={modal.setActiveTab}
      dirtyTabs={modal.dirtyTabs}
    />
  );
}
