import { appRpc } from "@mainview-bridge";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { presetInstallRoots, toolPresetById } from "../../../shared/toolPresets";
import type {
  AppConfig,
  AppLanguage,
  AppSettings,
  EditorViewMode,
  GitBackupConfig,
  GitBackupResult,
} from "../../../shared/types";
import { useAppTranslation } from "../../i18n/i18n";
import { setSuppressSuccessNotifications } from "../notifications/notify";
import { defaultGitBackupConfig, sameGitBackupConfig, validateGitBackupConfig } from "./gitBackup";
import { cleanPath } from "./paths";
import { isPendingRemoval, markRowRemoval, restoreRow } from "./pendingRemoval";
import {
  buildScanRootRows,
  createScanRootRow,
  type ScanRootRow,
  sameScanRoots,
  validateScanRootRows,
} from "./scanRoots";
import {
  availableToolPresets,
  buildToolRows,
  createToolRow,
  sameTools,
  type ToolRow,
  toolRowFromPreset,
  validateToolRows,
} from "./tools";

export type SettingsTab = "general" | "library" | "tools" | "backup" | "updates";

type SaveSettingsOptions = {
  activeLibraryItemId: string | null;
  backupAfterSave?: boolean;
  toolMappings: AppConfig["toolMappings"];
  reloadSkills: (preferredId?: string) => Promise<string | null>;
  reloadToolStatuses: (itemId: string) => Promise<void>;
};

function backupResultSucceeded(result: GitBackupResult) {
  return result.state === "ready" || result.state === "up-to-date";
}

/**
 * Keeps settings modal state separate from saved app settings so users can edit rows,
 * validate them, and cancel without mutating the live config.
 */
export function useSettingsState() {
  const { t } = useAppTranslation();
  const tRef = useRef(t);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [scanRootRows, setScanRootRows] = useState(buildScanRootRows([]));
  const [toolRows, setToolRows] = useState(buildToolRows([]));
  const [suppressSuccess, setSuppressSuccess] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>("system");
  const [defaultEditorMode, setDefaultEditorMode] = useState<EditorViewMode>("preview");
  const [gitBackup, setGitBackup] = useState<GitBackupConfig>(defaultGitBackupConfig());
  const [gitBackupInitializing, setGitBackupInitializing] = useState(false);
  const [gitBackupInitializeSucceeded, setGitBackupInitializeSucceeded] = useState(false);
  const [gitBackupError, setGitBackupError] = useState<string | null>(null);
  const [activeToolRowId, setActiveToolRowId] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const scanRootValidation = useMemo(() => validateScanRootRows(scanRootRows), [scanRootRows]);
  const toolValidation = useMemo(() => validateToolRows(toolRows), [toolRows]);
  const gitBackupValidation = useMemo(() => validateGitBackupConfig(gitBackup), [gitBackup]);
  const presetTools = useMemo(() => availableToolPresets(toolRows), [toolRows]);
  const libraryDirty = useMemo(
    () => !sameScanRoots(scanRootValidation.cleanedRoots, appSettings?.scanRoots ?? []),
    [appSettings?.scanRoots, scanRootValidation.cleanedRoots]
  );
  const toolsDirty = useMemo(
    () => !sameTools(toolValidation.tools, appSettings?.tools ?? []),
    [appSettings?.tools, toolValidation.tools]
  );
  const generalDirty = useMemo(
    () =>
      suppressSuccess !== (appSettings?.suppressSuccessNotifications ?? false) ||
      language !== (appSettings?.language ?? "system") ||
      defaultEditorMode !== (appSettings?.defaultEditorMode ?? "preview"),
    [
      appSettings?.defaultEditorMode,
      appSettings?.language,
      appSettings?.suppressSuccessNotifications,
      defaultEditorMode,
      language,
      suppressSuccess,
    ]
  );
  const backupDirty = useMemo(
    () =>
      !sameGitBackupConfig(
        gitBackupValidation.config,
        appSettings?.gitBackup ?? defaultGitBackupConfig()
      ),
    [appSettings?.gitBackup, gitBackupValidation.config]
  );
  const settingsChanged = libraryDirty || toolsDirty || generalDirty || backupDirty;

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const resetRows = useCallback((settings: AppSettings | null) => {
    setScanRootRows(buildScanRootRows(settings?.scanRoots ?? []));
    setToolRows(buildToolRows(settings?.tools ?? []));
    setSuppressSuccess(settings?.suppressSuccessNotifications ?? false);
    setLanguage(settings?.language ?? "system");
    setDefaultEditorMode(settings?.defaultEditorMode ?? "preview");
    setGitBackup(settings?.gitBackup ?? defaultGitBackupConfig());
    setActiveToolRowId(null);
  }, []);

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
      resetRows(appSettings);
    },
    [appSettings, resetRows]
  );

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setSettingsError(null);
    resetRows(appSettings);
  }, [appSettings, resetRows]);

  const saveSettings = useCallback(
    async ({
      activeLibraryItemId,
      backupAfterSave = false,
      reloadSkills,
      reloadToolStatuses,
      toolMappings,
    }: SaveSettingsOptions) => {
      if (scanRootValidation.hasErrors || toolValidation.hasErrors || gitBackupValidation.hasErrors)
        return;
      setSettingsSaving(true);
      try {
        const scanRootsChanged = !sameScanRoots(
          scanRootValidation.cleanedRoots,
          appSettings?.scanRoots ?? []
        );
        const nextSettings = await appRpc.request.saveConfig({
          scanRoots: scanRootValidation.cleanedRoots,
          tools: toolValidation.tools,
          toolMappings,
          suppressSuccessNotifications: suppressSuccess,
          language,
          defaultEditorMode,
          onboardingTourCompleted: appSettings?.onboardingTourCompleted ?? false,
          gitBackup: gitBackupValidation.config,
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
      defaultEditorMode,
      gitBackupValidation.config,
      gitBackupValidation.hasErrors,
      language,
      resetRows,
      scanRootValidation.cleanedRoots,
      scanRootValidation.hasErrors,
      suppressSuccess,
      toolValidation.hasErrors,
      toolValidation.tools,
      t,
    ]
  );

  const updateScanRoot = useCallback((id: string, value: string) => {
    setScanRootRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, path: value } : row))
    );
  }, []);

  const addScanRoot = useCallback(() => {
    setScanRootRows((currentRows) => [...currentRows, createScanRootRow()]);
  }, []);

  const removeScanRoot = useCallback(
    (id: string) => {
      // Scan roots are stored as bare path strings, so we identify saved rows
      // by matching the cleaned path against the saved set.
      const savedPaths = new Set(appSettings?.scanRoots ?? []);
      setScanRootRows((currentRows) => {
        const target = currentRows.find((row) => row.id === id);
        const wasSaved = target ? savedPaths.has(cleanPath(target.path)) : false;
        const savedIds = wasSaved ? new Set([id]) : new Set<string>();
        const nextRows = markRowRemoval(currentRows, id, savedIds);
        // Always keep at least one editable (non-pending) blank row visible so
        // first-time setup still works.
        const hasEditable = nextRows.some((row) => !row.pendingRemoval);
        return hasEditable ? nextRows : [...nextRows, createScanRootRow()];
      });
    },
    [appSettings?.scanRoots]
  );

  const restoreScanRoot = useCallback((id: string) => {
    setScanRootRows((currentRows) => restoreRow(currentRows, id));
  }, []);

  const updateTool = useCallback((id: string, field: keyof ToolRow, value: string) => {
    setToolRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  }, []);

  const appendAndOpenToolRow = useCallback((tool: ToolRow) => {
    setToolRows((currentRows) => {
      // If a row with this id is currently marked for removal (e.g. user clicked
      // Remove on a preset, then Quick Add'd it again) restore it in place
      // instead of appending a duplicate.
      if (isPendingRemoval(currentRows, tool.id)) {
        return restoreRow(currentRows, tool.id);
      }
      return [...currentRows, tool];
    });
    setActiveToolRowId(tool.id);
  }, []);

  const addTool = useCallback(() => {
    appendAndOpenToolRow(createToolRow());
  }, [appendAndOpenToolRow]);

  const pickToolInstallFolder = useCallback(
    async (id: string, field: "skillInstallRoot" | "agentInstallRoot") => {
      const selectedPath = await appRpc.request.pickToolInstallFolder();
      if (!selectedPath) return null;
      setToolRows((currentRows) =>
        currentRows.map((row) => (row.id === id ? { ...row, [field]: selectedPath } : row))
      );
      setActiveToolRowId(id);
      return selectedPath;
    },
    []
  );

  const addPresetTool = useCallback(
    (presetId: string) => {
      const preset = toolPresetById(presetId);
      if (!preset) return;
      const suggestedRoots = appSettings
        ? presetInstallRoots(preset, appSettings.homeDirectory, appSettings.platform)
        : { skill: [], agent: [] };
      const tool = toolRowFromPreset(preset, {
        skill: suggestedRoots.skill[0] ?? "",
        agent: suggestedRoots.agent[0] ?? "",
      });
      appendAndOpenToolRow(tool);
    },
    [appSettings, appendAndOpenToolRow]
  );

  const removeTool = useCallback(
    (id: string) => {
      const savedToolIds = new Set((appSettings?.tools ?? []).map((tool) => tool.id));
      setToolRows((currentRows) => markRowRemoval(currentRows, id, savedToolIds));
      setActiveToolRowId((currentId) => (currentId === id ? null : currentId));
    },
    [appSettings?.tools]
  );

  const restoreToolRow = useCallback((id: string) => {
    setToolRows((currentRows) => restoreRow(currentRows, id));
    setActiveToolRowId(id);
  }, []);

  const updateGitBackup = useCallback(
    <K extends keyof GitBackupConfig>(key: K, value: GitBackupConfig[K]) => {
      setGitBackup((current) => ({ ...current, [key]: value }));
      setGitBackupError(null);
      setGitBackupInitializeSucceeded(false);
    },
    []
  );

  const pickGitBackupRepository = useCallback(async () => {
    const selectedPath = await appRpc.request.pickGitBackupRepositoryFolder();
    if (!selectedPath) return;
    setGitBackup((current) => ({ ...current, repositoryPath: selectedPath }));
    setGitBackupError(null);
    setGitBackupInitializeSucceeded(false);
  }, []);

  const initializeGitBackup = useCallback(async () => {
    setGitBackupInitializing(true);
    setGitBackupInitializeSucceeded(false);
    try {
      const result = await appRpc.request.initializeGitBackup({
        gitBackup: gitBackupValidation.config,
      });
      if (!backupResultSucceeded(result)) {
        throw new Error(result.message || tRef.current("settings.backup.error.initialize"));
      }
      setGitBackupError(null);
      setGitBackupInitializeSucceeded(true);
      window.setTimeout(() => setGitBackupInitializeSucceeded(false), 1600);
    } catch (nextError) {
      setGitBackupError(
        nextError instanceof Error
          ? nextError.message
          : tRef.current("settings.backup.error.initialize")
      );
    } finally {
      setGitBackupInitializing(false);
    }
  }, [gitBackupValidation.config]);

  return {
    appSettings,
    loadSettings,
    setAppSettings,
    modal: {
      activeTab: settingsTab,
      close: closeSettings,
      errorMessage: settingsError,
      hasChanges: settingsChanged,
      hasValidationErrors:
        scanRootValidation.hasErrors || toolValidation.hasErrors || gitBackupValidation.hasErrors,
      open: openSettings,
      opened: settingsOpen,
      save: saveSettings,
      saving: settingsSaving,
      setActiveTab: setSettingsTab,
      dirtyTabs: {
        general: generalDirty,
        library: libraryDirty,
        tools: toolsDirty,
        backup: backupDirty,
      },
    },
    library: {
      addRow: addScanRoot,
      rows: scanRootRows as ScanRootRow[],
      updateRow: updateScanRoot,
      removeRow: removeScanRoot,
      restoreRow: restoreScanRoot,
      validation: scanRootValidation,
    },
    general: {
      defaultEditorMode,
      language,
      setDefaultEditorMode,
      setLanguage,
      suppressSuccessNotifications: suppressSuccess,
      setSuppressSuccessNotifications: setSuppressSuccess,
    },
    tools: {
      addPreset: addPresetTool,
      addRow: addTool,
      activeRowId: activeToolRowId,
      availablePresets: presetTools,
      pickInstallFolder: pickToolInstallFolder,
      removeRow: removeTool,
      restoreRow: restoreToolRow,
      rows: toolRows,
      setActiveRowId: setActiveToolRowId,
      updateRow: updateTool,
      validation: toolValidation,
    },
    backup: {
      config: gitBackup,
      errorMessage: gitBackupError,
      hasUnsavedChanges: backupDirty,
      initialize: initializeGitBackup,
      initializing: gitBackupInitializing,
      initializeSucceeded: gitBackupInitializeSucceeded,
      issue: gitBackupValidation.issue,
      pickRepository: pickGitBackupRepository,
      updateConfig: updateGitBackup,
    },
  };
}
