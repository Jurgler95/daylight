#!/usr/bin/env node
/**
 * Schreibt die Stichpunkte einer Version aus der Updatehistorie der App als Markdown auf stdout,
 * auf Deutsch und darunter auf Englisch, für die Beschreibung des GitHub-Releases. Bricht ab, wenn die Version nicht zu `app.json`,
 * `package.json`, `package-lock.json` und dem obersten Eintrag der Updatehistorie passt, wenn der
 * Eintrag in einer der beiden Sprachen keine Stichpunkte hat, wenn Deutsch und Englisch verschieden
 * viele Punkte haben oder wenn `versionCode` nicht über dem des letzten Versions-Tags
 * liegt, denn sonst nimmt Android das Update nicht an.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .github/scripts/release-notes.mjs 1.0.11
 *
 * Braucht Node 22.18 oder neuer, weil die Updatehistorie direkt als TypeScript geladen wird, und
 * die Versions-Tags im lokalen Klon. Übernommen aus der Zyklus-App.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { RELEASES } from '../../lib/changelog/index.ts';

const version = process.argv[2]?.replace(/^v/, '');
if (!version) {
  console.error('Aufruf: release-notes.mjs <version>');
  process.exit(1);
}

const readJson = (path) => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
const app = readJson('app.json');
const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
const release = RELEASES[0];

const problems = [
  ['app.json', app.expo.version],
  ['package.json', pkg.version],
  ['package-lock.json', lock.version],
  ['erster Eintrag der Updatehistorie', release?.version],
]
  .filter(([, found]) => found !== version)
  .map(([where, found]) => `${where}: ${found}, erwartet ${version}`);

if (release) {
  const { de = [], en = [] } = release.changes ?? {};
  if (de.length === 0) problems.push('Der Eintrag in der Updatehistorie hat keine deutschen Stichpunkte');
  if (en.length === 0) problems.push('Der Eintrag in der Updatehistorie hat keine englischen Stichpunkte');
  if (de.length !== en.length) problems.push(`Deutsch hat ${de.length} Stichpunkte, Englisch ${en.length}`);
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

const previous = previousVersionCode();
if (previous && app.expo.android.versionCode <= previous.versionCode) {
  problems.push(`versionCode ${app.expo.android.versionCode} liegt nicht über ${previous.versionCode} aus ${previous.tag}`);
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

console.log(release.changes.de.map((change) => `- ${change}`).join('\n'));
console.log('\n**English**\n');
console.log(release.changes.en.map((change) => `- ${change}`).join('\n'));
console.log(`\nversionCode ${app.expo.android.versionCode}, erschienen am ${release.date}.`);
console.log('Signiert mit dem Daylight-Schlüssel, SHA-256 des Zertifikats: 9D:5E:FF:54:19:70:F6:09:85:7F:B6:F8:43:1C:E8:62:74:B4:6E:FB:2E:1B:56:A5:9B:63:CC:87:04:1F:C9:8A');
