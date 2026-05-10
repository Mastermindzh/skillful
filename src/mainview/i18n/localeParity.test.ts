import { describe, expect, it } from "vitest";
import { dictionaries } from "./messages";

const localeNames = Object.keys(dictionaries) as Array<keyof typeof dictionaries>;
const referenceLocale = "en" as const;
const referenceKeys = Object.keys(dictionaries[referenceLocale]).sort();

describe("locale parity", () => {
  for (const locale of localeNames) {
    if (locale === referenceLocale) continue;

    it(`'${locale}' has the same key set as '${referenceLocale}'`, () => {
      const localeKeys = Object.keys(dictionaries[locale]).sort();

      const missing = referenceKeys.filter((key) => !localeKeys.includes(key));
      const extra = localeKeys.filter((key) => !referenceKeys.includes(key));

      expect({ locale, missing, extra }).toEqual({
        locale,
        missing: [],
        extra: [],
      });
    });
  }
});
