#!/usr/bin/env node
/**
 * Ermittelt das Design des Tages für das Store-Icon nach dem Kalender der App
 * (`lib/seasons/calendar.ts`, Feste vor Jahreszeiten) und vergleicht es mit `store/season.js`.
 *
 *   node scripts/store-season.mjs                    zeigt heute (Europe/Berlin) und den Stand in season.js
 *   node scripts/store-season.mjs --write            setzt season.js auf heute, wenn es abweicht
 *   node scripts/store-season.mjs --date 2026-12-24  rechnet für diesen Tag statt für heute
 *
 * In einer GitHub-Action schreibt es `design`, `current` und `changed` nach `$GITHUB_OUTPUT`
 * (`.github/workflows/store-icon.yml`).
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { calendar } from './seasons.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'store/season.js');

function option(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

/** Today in Berlin as "YYYY-MM-DD"; en-CA writes dates in exactly that order. */
function berlinToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const day = option('--date') ?? berlinToday();
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`--date: YYYY-MM-DD erwartet, nicht ${day}`);
const design = calendar.activeDesign(day);

const source = readFileSync(FILE, 'utf8');
const context = { window: {} };
runInNewContext(source, context);
const current = context.window.SEASON ?? null;
const changed = current !== design;

console.log(`${day}: ${design}, store/season.js: ${current}${changed ? '' : ' (unverändert)'}`);

if (changed && process.argv.includes('--write')) {
  const line = /^window\.SEASON = .*;$/m;
  if (!line.test(source)) throw new Error('store/season.js: Zeile window.SEASON = ...; fehlt');
  writeFileSync(FILE, source.replace(line, `window.SEASON = '${design}';`));
  console.log(`store/season.js auf '${design}' gesetzt`);
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `design=${design}\ncurrent=${current}\nchanged=${changed}\n`);
}
