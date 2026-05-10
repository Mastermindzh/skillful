import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import type { AppLanguage } from "../../shared/types";
import {
  defaultLocale,
  dictionaries,
  type SupportedLocale,
  type TranslationKey,
  type TranslationValues,
} from "./messages";

export function normalizeLocale(locale: string | undefined): SupportedLocale {
  if (!locale) return defaultLocale;
  const normalized = locale.toLowerCase();
  if (normalized in dictionaries) return normalized as SupportedLocale;
  const language = normalized.split("-")[0];
  return language in dictionaries ? (language as SupportedLocale) : defaultLocale;
}

function detectInitialLocale() {
  if (typeof navigator === "undefined") return defaultLocale;
  return normalizeLocale(navigator.languages?.[0] ?? navigator.language);
}

export function resolveAppLanguage(language: AppLanguage): SupportedLocale {
  return language === "system" ? detectInitialLocale() : normalizeLocale(language);
}

const resources = Object.fromEntries(
  Object.entries(dictionaries).map(([locale, messages]) => [locale, { translation: messages }])
);

void i18n.use(initReactI18next).init({
  resources,
  lng: resolveAppLanguage("system"),
  fallbackLng: defaultLocale,
  supportedLngs: Object.keys(dictionaries),
  keySeparator: false,
  nsSeparator: false,
  interpolation: {
    escapeValue: false,
    prefix: "{",
    suffix: "}",
  },
});

export function useAppTranslation() {
  const { t, i18n: instance } = useTranslation();
  return { i18n: instance, t: t as (key: TranslationKey, values?: TranslationValues) => string };
}

export type AppTranslate = ReturnType<typeof useAppTranslation>["t"];

export async function applyAppLanguage(language: AppLanguage) {
  await i18n.changeLanguage(resolveAppLanguage(language));
}

export { i18n };
