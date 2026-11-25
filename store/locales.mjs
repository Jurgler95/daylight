// Store-Sprachen ohne eigene Grafiken: Locale in fastlane/metadata/android → Locale, deren Bilder (Icon,
// Feature Graphic, Screenshots) sie im Play Store bekommt. Ohne eigene Bilder zeigte Play die der Standardsprache.
// Die Bilder liegen nicht doppelt im Repo, `scripts/store-images.mjs` kopiert sie erst beim Upload. Dieselbe
// Zuordnung legt in `.github/scripts/release-notes.mjs` fest, in welcher Sprache „Neu in dieser Version" dort steht.
//
// Sprachvarianten mit Oberfläche in ihrer Sprache (pt-PT, fr-CA, en-GB …) nehmen die Bilder der verwandten Sprache.
// nl-NL, pl-PL, tr-TR und id sind in der App übersetzt, haben aber noch keine Screenshots aus dem Emulator
// (store/screens/<lang>/); bis dahin zeigen sie die englischen Bilder, danach hier streichen.
export const BORROWED_IMAGES = {
  'nl-NL': 'en-US',
  'pl-PL': 'en-US',
  'tr-TR': 'en-US',
  id: 'en-US',
  'en-GB': 'en-US',
  'en-AU': 'en-US',
  'en-IN': 'en-US',
  'en-CA': 'en-US',
  'es-US': 'es-419',
  'fr-CA': 'fr-FR',
  'pt-PT': 'pt-BR',
};
