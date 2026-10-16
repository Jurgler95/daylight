/**
 * The display language, kept apart from i18next so the pure formatters (dates, numbers) can read it
 * without pulling in React. Set by `applyLanguage` in `lib/i18n`; German until then, as in the tests.
 */
export type Language = 'de' | 'en' | 'es' | 'pt' | 'fr' | 'it';

/** In the order of the language picker. `pt` is Brazilian Portuguese. */
export const LANGUAGES: readonly Language[] = ['de', 'en', 'es', 'fr', 'it', 'pt'];

/** Each language under its own name, so the way back is readable from any of them. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  pt: 'Português (Brasil)',
};

let current: Language = 'de';

export function currentLanguage(): Language {
  return current;
}

export function setCurrentLanguage(language: Language): void {
  current = language;
}

export function isLanguage(value: unknown): value is Language {
  return (LANGUAGES as readonly unknown[]).includes(value);
}

/** The language of any regional variant (`de-AT`, `es-MX`, `pt_PT`, ...), English for everything else. */
export function languageForLocale(locale: string): Language {
  const base = locale.toLowerCase().split(/[-_]/)[0];
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

/**
 * Separators per language, independent of the device's Intl data. French groups with a no-break
 * space so "8 412" never wraps; Spanish and French put one before the percent sign as well.
 */
const NUMBER_STYLE: Record<Language, { decimal: string; group: string; percent: string }> = {
  de: { decimal: ',', group: '.', percent: ' %' },
  en: { decimal: '.', group: ',', percent: '%' },
  es: { decimal: ',', group: '.', percent: ' %' },
  pt: { decimal: ',', group: '.', percent: '%' },
  fr: { decimal: ',', group: ' ', percent: ' %' },
  it: { decimal: ',', group: '.', percent: '%' },
};

export function numberStyle(language: Language = current): { decimal: string; group: string; percent: string } {
  return NUMBER_STYLE[language];
}
