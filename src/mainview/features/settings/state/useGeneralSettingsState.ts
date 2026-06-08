import { useCallback, useMemo, useState } from "react";
import type { AppLanguage, AppSettings, EditorViewMode } from "../../../../shared/types";

export function useGeneralSettingsState(appSettings: AppSettings | null) {
  const [suppressSuccess, setSuppressSuccess] = useState(false);
  const [minimizeToTrayOnClose, setMinimizeToTrayOnClose] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>("system");
  const [defaultEditorMode, setDefaultEditorMode] = useState<EditorViewMode>("preview");

  const dirty = useMemo(
    () =>
      suppressSuccess !== (appSettings?.suppressSuccessNotifications ?? false) ||
      minimizeToTrayOnClose !== (appSettings?.minimizeToTrayOnClose ?? false) ||
      language !== (appSettings?.language ?? "system") ||
      defaultEditorMode !== (appSettings?.defaultEditorMode ?? "preview"),
    [
      appSettings?.defaultEditorMode,
      appSettings?.language,
      appSettings?.minimizeToTrayOnClose,
      appSettings?.suppressSuccessNotifications,
      defaultEditorMode,
      language,
      minimizeToTrayOnClose,
      suppressSuccess,
    ]
  );

  const reset = useCallback((settings: AppSettings | null) => {
    setSuppressSuccess(settings?.suppressSuccessNotifications ?? false);
    setMinimizeToTrayOnClose(settings?.minimizeToTrayOnClose ?? false);
    setLanguage(settings?.language ?? "system");
    setDefaultEditorMode(settings?.defaultEditorMode ?? "preview");
  }, []);

  return {
    defaultEditorMode,
    dirty,
    language,
    minimizeToTrayOnClose,
    reset,
    saveFields: {
      defaultEditorMode,
      language,
      minimizeToTrayOnClose,
      suppressSuccessNotifications: suppressSuccess,
    },
    setDefaultEditorMode,
    setLanguage,
    setMinimizeToTrayOnClose,
    setSuppressSuccessNotifications: setSuppressSuccess,
    suppressSuccessNotifications: suppressSuccess,
  };
}
