/**
 * The display language, kept apart from i18next so the pure formatters (dates, numbers) can read it
 * without pulling in React. Set by `applyLanguage` in `lib/i18n`; German until then, as in the tests.
 */
export type Language = 'de' | 'en' | 'es' | 'pt' | 'fr' | 'it' | 'nl' | 'pl' | 'tr' | 'id';

/** In the order of the language picker, alphabetical by own name. `pt` is Brazilian Portuguese. */
export const LANGUAGES: readonly Language[] = ['id', 'de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'tr'];

/** Each language under its own name, so the way back is readable from any of them. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  id: 'Bahasa Indonesia',
  nl: 'Nederlands',
  pl: 'Polski',
  pt: 'Português (Brasil)',
  tr: 'Türkçe',
};

let current: Language = 'de';

export function currentLanguage(): Language {
  return current;
}

export function setCurrentLanguage(language: Language): void {
  current = language;
}

/**
 * Upper case for headings in the app language. Turkish keeps the dot: "i" becomes "İ", "ı" becomes "I"
 * ("VERİLER", not "VERILER"). Done by hand, since Hermes may ignore the locale of `toLocaleUpperCase`.
 */
export function upper(text: string, language: Language = current): string {
  if (language === 'tr') text = text.replace(/i/g, 'İ').replace(/ı/g, 'I');
  return text.toUpperCase();
}

export function isLanguage(value: unknown): value is Language {
  return (LANGUAGES as readonly unknown[]).includes(value);
}

/** Old Java code for Indonesian, which some Android versions still report ("in-ID"). */
const LEGACY_CODES: Record<string, Language> = { in: 'id' };

/** The language of any regional variant (`de-AT`, `es-MX`, `pt_PT`, ...), English for everything else. */
export function languageForLocale(locale: string): Language {
  const code = locale.toLowerCase().split(/[-_]/)[0] ?? '';
  const base = LEGACY_CODES[code] ?? code;
  return isLanguage(base) ? base : 'en';
}

/** The language the device asks for. Hermes reads the locale from Android; without Intl, English. */
export function deviceLanguage(): Language {
  try {
    return languageForLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'en';
  }
}

export interface NumberStyle {
  decimal: string;
  group: string;
  /** Appended to the number, with a no-break space where the language puts one. */
  percent: string;
  /** Turkish writes the sign first: "%74". */
  percentFirst?: boolean;
}

/**
 * Separators per language, independent of the device's Intl data. French and Polish group with a
 * no-break space so "8 412" never wraps; Spanish and French put one before the percent sign as well.
 */
const NUMBER_STYLE: Record<Language, NumberStyle> = {
  de: { decimal: ',', group: '.', percent: ' %' },
  en: { decimal: '.', group: ',', percent: '%' },
  es: { decimal: ',', group: '.', percent: ' %' },
  pt: { decimal: ',', group: '.', percent: '%' },
  fr: { decimal: ',', group: ' ', percent: ' %' },
  it: { decimal: ',', group: '.', percent: '%' },
  nl: { decimal: ',', group: '.', percent: '%' },
  pl: { decimal: ',', group: '\u00a0', percent: '%' },
  tr: { decimal: ',', group: '.', percent: '%', percentFirst: true },
  id: { decimal: ',', group: '.', percent: '%' },
};

export function numberStyle(language: Language = current): NumberStyle {
  return NUMBER_STYLE[language];
}
