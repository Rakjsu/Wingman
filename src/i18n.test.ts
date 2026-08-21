import { describe, expect, it } from "vitest";
import { LANGUAGES, dictionaries, t, type Lang, type TKey } from "./i18n";

const languages = Object.keys(dictionaries) as Lang[];
const englishKeys = Object.keys(dictionaries.en) as TKey[];

describe("dictionaries", () => {
  it("covers every language advertised in the picker", () => {
    for (const { code } of LANGUAGES) {
      expect(dictionaries[code], `missing dictionary for ${code}`).toBeDefined();
    }
    expect(LANGUAGES).toHaveLength(languages.length);
  });

  it.each(languages)("%s has exactly the same keys as English", (lang) => {
    const keys = Object.keys(dictionaries[lang]);
    const missing = englishKeys.filter((key) => !keys.includes(key));
    const extra = keys.filter((key) => !englishKeys.includes(key as TKey));

    expect(missing, `${lang} is missing keys`).toEqual([]);
    expect(extra, `${lang} has keys English does not`).toEqual([]);
  });

  it.each(languages)("%s has no empty strings", (lang) => {
    for (const [key, value] of Object.entries(dictionaries[lang])) {
      expect(value.trim(), `${lang}.${key} is empty`).not.toBe("");
    }
  });

  it.each(languages)("%s keeps the same placeholders as English", (lang) => {
    const placeholders = (s: string) => (s.match(/\{[a-z]+\}/gi) ?? []).sort().join(",");

    for (const key of englishKeys) {
      expect(
        placeholders(dictionaries[lang][key]),
        `${lang}.${key} placeholders differ`,
      ).toBe(placeholders(dictionaries.en[key]));
    }
  });

  it.each(languages)("%s keeps plural forms wherever English has them", (lang) => {
    for (const key of englishKeys) {
      const englishIsPlural = dictionaries.en[key].includes("|");
      const localIsPlural = dictionaries[lang][key].includes("|");
      expect(localIsPlural, `${lang}.${key} plural mismatch`).toBe(englishIsPlural);
    }
  });
});

describe("t", () => {
  it("substitutes named variables", () => {
    expect(t("toast.installed", { name: "7-Zip" })).toContain("7-Zip");
  });

  it("selects the singular form for one", () => {
    expect(t("search.results", { n: 1 })).toBe("1 result");
  });

  it("selects the plural form for anything else", () => {
    expect(t("search.results", { n: 0 })).toBe("0 results");
    expect(t("search.results", { n: 5 })).toBe("5 results");
  });

  it("returns the key itself when a lookup misses", () => {
    expect(t("definitely.not.a.key" as TKey)).toBe("definitely.not.a.key");
  });
});
