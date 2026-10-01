/**
 * The display language, kept apart from i18next so the pure formatters (dates, numbers) can read it
 * without pulling in React. Set by `applyLanguage` in `lib/i18n`; German until then, as in the tests.
 */
export type Language = 'de' | 'en';

export const LANGUAGES: readonly Language[] = ['de', 'en'];

let current: Language = 'de';

export function currentLanguage(): Language {
  return current;
}

export function setCurrentLanguage(language: Language): void {
  current = language;
}

export function isLanguage(value: unknown): value is Language {
  return value === 'de' || value === 'en';
}

/** German for any German locale (`de`, `de-DE`, `de-LU`, ...), English for everything else. */
export function languageForLocale(locale: string): Language {
  return locale.toLowerCase().split(/[-_]/)[0] === 'de' ? 'de' : 'en';
}

/** The language the device asks for. Hermes reads the locale from Android; without Intl, English. */
export function deviceLanguage(): Language {
  try {
    return languageForLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'en';
  }
}
