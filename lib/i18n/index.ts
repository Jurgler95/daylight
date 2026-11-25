import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { setCurrentLanguage, type Language } from './language';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import id from './locales/id.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import tr from './locales/tr.json';

export const resources = {
  de: { translation: de },
  en: { translation: en },
  es: { translation: es },
  pt: { translation: pt },
  fr: { translation: fr },
  it: { translation: it },
  nl: { translation: nl },
  pl: { translation: pl },
  tr: { translation: tr },
  id: { translation: id },
} as const satisfies Record<Language, unknown>;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'de',
  // A missing text shows in English, an English one in German; the tests keep every key in every file.
  fallbackLng: { en: ['de'], default: ['en'] },
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Switches texts and formatters together; screens re-render through react-i18next. */
export function applyLanguage(language: Language): void {
  setCurrentLanguage(language);
  if (i18n.language !== language) void i18n.changeLanguage(language);
}

export default i18n;
