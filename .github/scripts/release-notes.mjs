#!/usr/bin/env node
/**
 * Schreibt die Stichpunkte einer Version aus der Updatehistorie der App als Markdown auf stdout,
 * auf Deutsch und darunter auf Englisch, für die Beschreibung des GitHub-Releases. Bricht ab, wenn die Version nicht zu `app.json`,
 * `package.json`, `package-lock.json` und dem obersten Eintrag der Updatehistorie passt, wenn der
 * Eintrag in einer Sprache der App keine Stichpunkte hat, wenn die Sprachen verschieden viele Punkte
 * haben oder wenn `versionCode` nicht über dem des letzten Versions-Tags
 * liegt, denn sonst nimmt Android das Update nicht an.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .github/scripts/release-notes.mjs 1.0.11
 *
 * Mit `--whatsnew <ordner>` schreibt es stattdessen die Texte für „Neu in dieser Version" im Play
 * Store, je Store-Sprache eine Datei wie `whatsnew-de-DE` oder `whatsnew-es-419`, nur für die Sprachen,
 * die der Eintrag hat. Play nimmt höchstens 500 Zeichen je Sprache, das prüft auch der normale
 * Aufruf, damit es vor dem Build auffällt.
 *
 * Braucht Node 22.18 oder neuer, weil die Updatehistorie direkt als TypeScript geladen wird, und
 * die Versions-Tags im lokalen Klon. Übernommen aus der Zyklus-App.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { RELEASES } from '../../lib/changelog/index.ts';
import { LANGUAGES } from '../../lib/i18n/language.ts';

const version = process.argv[2]?.replace(/^v/, '');
const whatsnewAt = process.argv[3] === '--whatsnew' ? process.argv[4] : null;
if (!version) {
  console.error('Aufruf: release-notes.mjs <version> [--whatsnew <ordner>]');
  process.exit(1);
}

const readJson = (path) => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
const app = readJson('app.json');
const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
const release = RELEASES[0];
const PLAY_LIMIT = 500;
/** Store-Sprachen je Sprache der App, wie in fastlane/metadata/android. Spanisch für Spanien und Lateinamerika. */
const PLAY_LOCALES = { de: ['de-DE'], en: ['en-US'], es: ['es-ES', 'es-419'], pt: ['pt-BR'], fr: ['fr-FR'], it: ['it-IT'] };

const unmapped = LANGUAGES.filter((language) => !PLAY_LOCALES[language]);
if (unmapped.length > 0) {
  console.error(`Keine Store-Sprache für ${unmapped.join(', ')} in PLAY_LOCALES`);
  process.exit(1);
}

const problems = [
  ['app.json', app.expo.version],
  ['package.json', pkg.version],
  ['package-lock.json', lock.version],
  ['erster Eintrag der Updatehistorie', release?.version],
]
  .filter(([, found]) => found !== version)
  .map(([where, found]) => `${where}: ${found}, erwartet ${version}`);

if (release) {
  const changes = release.changes ?? {};
  // Ein später Upload einer älteren Version, die noch nicht alle Sprachen kannte, nimmt, was da ist.
  for (const language of whatsnewAt ? ['de', 'en'] : LANGUAGES) {
    const count = changes[language]?.length ?? 0;
    if (count === 0) problems.push(`Der Eintrag in der Updatehistorie hat keine Stichpunkte auf ${language}`);
    else if (count !== changes.de?.length) problems.push(`Deutsch hat ${changes.de?.length ?? 0} Stichpunkte, ${language} ${count}`);
  }
  for (const [locale, text] of Object.entries(whatsnew(release))) {
    if (text.length > PLAY_LIMIT) problems.push(`Der ${locale}-Text für Play hat ${text.length} Zeichen, erlaubt sind ${PLAY_LIMIT}`);
  }
}

/** „Neu in dieser Version" für Play: die Stichpunkte je Store-Sprache, eine Zeile pro Punkt. */
function whatsnew({ changes }) {
  return Object.fromEntries(
    Object.entries(PLAY_LOCALES).flatMap(([language, locales]) =>
      changes?.[language]?.length ? locales.map((locale) => [locale, changes[language].map((change) => `• ${change}`).join('\n')]) : [],
    ),
  );
}

/** `versionCode` des letzten Versions-Tags vor dieser Version, falls es einen gibt. */
function previousVersionCode() {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let tag;
  try {
    tag = git('describe', '--tags', '--abbrev=0', '--match', 'v*', '--exclude', `v${version}`);
  } catch {
    return null;
  }
  return { tag, versionCode: JSON.parse(git('show', `${tag}:app.json`)).expo.android.versionCode };
}

// Für die Play-Texte nicht nötig: das Bundle ist dann schon gebaut und geprüft, und ein später
// Upload einer älteren Version fände sonst neuere Tags.
const previous = whatsnewAt ? null : previousVersionCode();
if (previous && app.expo.android.versionCode <= previous.versionCode) {
  problems.push(`versionCode ${app.expo.android.versionCode} liegt nicht über ${previous.versionCode} aus ${previous.tag}`);
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

if (whatsnewAt) {
  mkdirSync(whatsnewAt, { recursive: true });
  for (const [language, text] of Object.entries(whatsnew(release))) writeFileSync(join(whatsnewAt, `whatsnew-${language}`), `${text}\n`);
  process.exit(0);
}

console.log(release.changes.de.map((change) => `- ${change}`).join('\n'));
console.log('\n**English**\n');
console.log(release.changes.en.map((change) => `- ${change}`).join('\n'));
console.log(`\nversionCode ${app.expo.android.versionCode}, erschienen am ${release.date}.`);
console.log('Signiert mit dem Daylight-Schlüssel, SHA-256 des Zertifikats: 9D:5E:FF:54:19:70:F6:09:85:7F:B6:F8:43:1C:E8:62:74:B4:6E:FB:2E:1B:56:A5:9B:63:CC:87:04:1F:C9:8A');
