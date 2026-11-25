#!/usr/bin/env node
/**
 * Legt den Store-Eintrag für den Upload über fastlane supply in einen eigenen Ordner, mit Bildern für die
 * Store-Sprachen, die keine eigenen haben (`store/locales.mjs`). Das Repo bleibt unberührt, die Bilder liegen dort
 * nur einmal je Sprache der App.
 *
 *   node scripts/store-images.mjs <ziel>          # ganzer Eintrag (Texte und Bilder) nach <ziel>
 *   node scripts/store-images.mjs --icon <ziel>   # nur images/icon.png je Sprache, für store-icon.yml
 *   node scripts/store-images.mjs --check         # nur prüfen
 *
 * Bricht ab, wenn ein Sprachordner weder eigene Bilder hat noch in `store/locales.mjs` steht, wenn eine Sprache
 * dort eigene Bilder hat (dann aus der Liste nehmen) oder wenn ihre Quelle fehlt.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BORROWED_IMAGES } from '../store/locales.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const METADATA = join(ROOT, 'fastlane/metadata/android');
const ICON_ONLY = process.argv.includes('--icon');
const CHECK_ONLY = process.argv.includes('--check');
const target = process.argv.slice(2).find((arg) => !arg.startsWith('--'));

if (!CHECK_ONLY && !target) {
  console.error('Aufruf: store-images.mjs [--icon] <ziel> | --check');
  process.exit(1);
}

const locales = readdirSync(METADATA).filter((name) => !name.startsWith('.') && statSync(join(METADATA, name)).isDirectory());
const hasIcon = (locale) => existsSync(join(METADATA, locale, 'images', 'icon.png'));

const problems = [];
for (const locale of locales) {
  const source = BORROWED_IMAGES[locale];
  if (source === undefined && !hasIcon(locale)) problems.push(`${locale} hat keine Bilder und steht nicht in store/locales.mjs`);
  if (source !== undefined && existsSync(join(METADATA, locale, 'images'))) problems.push(`${locale} hat eigene Bilder, in store/locales.mjs streichen`);
  if (source !== undefined && !hasIcon(source)) problems.push(`${locale} soll die Bilder von ${source} bekommen, die gibt es nicht`);
}
for (const locale of Object.keys(BORROWED_IMAGES)) {
  if (!locales.includes(locale)) problems.push(`${locale} steht in store/locales.mjs, hat aber keinen Ordner in fastlane/metadata/android`);
}
if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
if (CHECK_ONLY) process.exit(0);

for (const locale of locales) {
  const from = join(METADATA, BORROWED_IMAGES[locale] ?? locale, 'images');
  const to = join(target, locale, 'images');
  if (ICON_ONLY) {
    mkdirSync(to, { recursive: true });
    cpSync(join(from, 'icon.png'), join(to, 'icon.png'));
  } else {
    cpSync(join(METADATA, locale), join(target, locale), { recursive: true });
    if (BORROWED_IMAGES[locale]) cpSync(from, to, { recursive: true });
  }
  console.log(BORROWED_IMAGES[locale] ? `${locale} (Bilder von ${BORROWED_IMAGES[locale]})` : locale);
}
