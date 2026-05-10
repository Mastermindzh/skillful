import { describe, expect, it } from "vitest";
import { i18n, normalizeLocale } from "./i18n";

describe("normalizeLocale", () => {
  it("uses the exact supported locale when available", () => {
    expect(normalizeLocale("en")).toBe("en");
  });

  it("falls back from regional locales to their language", () => {
    expect(normalizeLocale("en-US")).toBe("en");
  });

  it("falls back to English for unsupported locales", () => {
    expect(normalizeLocale("fr-FR")).toBe("en");
  });

  it("falls back from Dutch regional locales to Dutch", () => {
    expect(normalizeLocale("nl-NL")).toBe("nl");
  });
});

describe("i18next", () => {
  it("interpolates named values", () => {
    expect(i18n.t("details.saveFile", { file: "SKILL.md" })).toBe("Save SKILL.md");
  });
});
