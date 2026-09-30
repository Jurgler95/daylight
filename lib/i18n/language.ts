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

/**
 * German on a German device, English everywhere else. Hermes reads the locale from Android; when
 * Intl is missing, German stays, since that is what the app was written in.
 */
export function deviceLanguage(): Language {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.toLowerCase().startsWith('de') ? 'de' : 'en';
  } catch {
    return 'de';
  }
}
