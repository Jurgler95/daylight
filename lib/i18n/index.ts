import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { setCurrentLanguage, type Language } from './language';
import de from './locales/de.json';
import en from './locales/en.json';

export const resources = { de: { translation: de }, en: { translation: en } } as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'de',
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Switches texts and formatters together; screens re-render through react-i18next. */
export function applyLanguage(language: Language): void {
  setCurrentLanguage(language);
  if (i18n.language !== language) void i18n.changeLanguage(language);
}

export default i18n;
