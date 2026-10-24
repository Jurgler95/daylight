#!/usr/bin/env node
/**
 * Rendert die Play-Store-Grafiken aus `store/graphics.html` nach `fastlane/metadata/android/<locale>/images/`
 * (de-DE, en-US, es-ES, es-419, pt-BR, fr-FR, it-IT), in der Ordnerstruktur, die fastlane supply und F-Droid erwarten.
 * Die Texte der Grafiken stehen je Sprache in `store/text/<lang>.js`.
 *
 *   node scripts/store-graphics.mjs          # alle Sprachen
 *   node scripts/store-graphics.mjs es fr    # nur diese
 *   node scripts/store-graphics.mjs --icon   # nur das Icon, etwa beim Wechsel des Saison-Icons
 *
 * Braucht Google Chrome (oder CHROME=/pfad/zu/chrome) und Netz für die Schrift von Google Fonts.
 * Die Screenshots der App liegen in `store/screens/<lang>/` und stammen aus einem Pixel-9-Emulator mit den
 * eingebauten Beispieldaten in der jeweiligen Sprache.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = pathToFileURL(join(ROOT, 'store/graphics.html')).href;
const ALL = [['de', 'de-DE'], ['en', 'en-US'], ['es', 'es-ES'], ['es', 'es-419'], ['pt', 'pt-BR'], ['fr', 'fr-FR'], ['it', 'it-IT']];
const ICON_ONLY = process.argv.includes('--icon');
const ONLY = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const LOCALES = ONLY.length ? ALL.filter(([lang]) => ONLY.includes(lang)) : ALL;
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const SHOTS = [
  ['shot-1', '1_today'],
  ['shot-2', '2_entry'],
  ['shot-3', '3_calendar'],
  ['shot-4', '4_insights'],
  ['shot-5', '5_year_in_pixels'],
  ['shot-6', '6_outlook'],
  ['shot-7', '7_turning_points'],
  ['shot-8', '8_private'],
];

function render(lang, asset, file, [width, height]) {
  execFileSync(CHROME, [
    '--headless=new',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--allow-file-access-from-files',
    '--virtual-time-budget=8000',
    `--window-size=${width},${height}`,
    `--screenshot=${file}`,
    `${PAGE}?asset=${asset}&lang=${lang}`,
  ], { stdio: 'ignore' });
  console.log(file.replace(ROOT + '/', ''));
}

for (const [lang, locale] of LOCALES) {
  const out = join(ROOT, 'fastlane/metadata/android', locale, 'images');
  if (ICON_ONLY) {
    render(lang, 'icon', join(out, 'icon.png'), [512, 512]);
    continue;
  }
  rmSync(join(out, 'phoneScreenshots'), { recursive: true, force: true });
  mkdirSync(join(out, 'phoneScreenshots'), { recursive: true });
  render(lang, 'icon', join(out, 'icon.png'), [512, 512]);
  render(lang, 'feature', join(out, 'featureGraphic.png'), [1024, 500]);
  for (const [asset, name] of SHOTS) render(lang, asset, join(out, 'phoneScreenshots', `${name}.png`), [1080, 1920]);
}
