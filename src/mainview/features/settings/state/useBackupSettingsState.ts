import { useCallback, useMemo, useState } from "react";
import type { AppSettings, GitBackupConfig } from "../../../../shared/types";
import {
  defaultGitBackupConfig,
  sameGitBackupConfig,
  validateGitBackupConfig,
} from "../model/gitBackup";

export function useBackupSettingsState(appSettings: AppSettings | null) {
  const [config, setConfig] = useState<GitBackupConfig>(defaultGitBackupConfig());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreNeedsConfirmation, setRestoreNeedsConfirmation] = useState(false);
  const [actionAttempted, setActionAttempted] = useState(false);

  const validation = useMemo(() => validateGitBackupConfig(config), [config]);
  const restoreValidation = useMemo(
    () => validateGitBackupConfig({ ...config, enabled: true }),
    [config]
  );
  const dirty = useMemo(
    () =>
      !sameGitBackupConfig(validation.config, appSettings?.gitBackup ?? defaultGitBackupConfig()),
    [appSettings?.gitBackup, validation.config]
  );
  const configured = Boolean(
    appSettings?.gitBackup.enabled || appSettings?.gitBackup.remoteUrl.trim()
  );

  const clearTransient = useCallback(() => {
    setErrorMessage(null);
    setActionAttempted(false);
    setRestoreNeedsConfirmation(false);
  }, []);

  const resetFromSettings = useCallback(
    (settings: AppSettings | null) => {
      setConfig(settings?.gitBackup ?? defaultGitBackupConfig());
      clearTransient();
    },
    [clearTransient]
  );

  const updateConfig = useCallback(
    <K extends keyof GitBackupConfig>(key: K, value: GitBackupConfig[K]) => {
      setConfig((current) => ({ ...current, [key]: value }));
      setErrorMessage(null);
      if (key === "remoteUrl" && String(value).trim()) {
        setActionAttempted(true);
      }
      setRestoreNeedsConfirmation(false);
    },
    []
  );

  const reset = useCallback(() => {
    setConfig(defaultGitBackupConfig());
    clearTransient();
  }, [clearTransient]);

  return {
    actionIssue: actionAttempted ? restoreValidation.issue : {},
    clearTransient,
    config,
    configured,
    dirty,
    errorMessage,
    issue: validation.issue,
    reset,
    resetFromSettings,
    restoreHasValidationErrors: restoreValidation.hasErrors,
    restoreNeedsConfirmation,
    restoreValidation,
    restoring,
    setActionAttempted,
    setErrorMessage,
    setRestoring,
    setRestoreNeedsConfirmation,
    updateConfig,
    validation,
  };
}
