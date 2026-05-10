import type { AppLanguage } from "../../shared/types";
import { enMessages } from "./locales/en";
import { nlMessages } from "./locales/nl";

export const dictionaries = {
  en: enMessages,
  nl: nlMessages,
} as const;

export type SupportedLocale = keyof typeof dictionaries;
export type TranslationKey = keyof typeof enMessages;
export type TranslationValues = Record<string, string | number>;

export const defaultLocale: SupportedLocale = "en";
export const defaultLanguage: AppLanguage = "system";
