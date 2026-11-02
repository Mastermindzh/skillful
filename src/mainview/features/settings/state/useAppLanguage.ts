import { useEffect } from "react";
import { applyAppLanguage } from "../../../i18n/i18n";
import type { SettingsState } from "./useSettingsState";

/** Applies the saved language, previewing the one being picked while settings are open. */
export function useAppLanguage(settings: SettingsState) {
  const language = settings.modal.opened
    ? settings.general.language
    : (settings.appSettings?.language ?? "system");

  useEffect(() => {
    void applyAppLanguage(language);
  }, [language]);
}
