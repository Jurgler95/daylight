import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';

export const resources = { de: { translation: de } } as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'de',
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
