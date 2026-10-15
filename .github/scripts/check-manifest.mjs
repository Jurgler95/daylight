#!/usr/bin/env node
/**
 * Prüft das Manifest einer fertig gebauten APK. Das ist der einzige Beleg, der zählt, nicht das
 * Manifest im Quellbaum: eine Abhängigkeit kann beim Build Berechtigungen nachschieben.
 *
 * Bricht ab, wenn `versionName` oder `versionCode` nicht zu `app.json` passen, wenn INTERNET, c2dm
 * oder Launcher-Badges auftauchen, wenn `android:allowBackup` nicht aus ist, wenn die
 * `dataExtractionRules` den Umzug auf ein neues Handy nicht sperren oder wenn von Health
 * Connect etwas anderes als genau die fünf lesenden Berechtigungen dasteht
 * (`docs/decisions/gesundheitsdaten-health-connect.md`). Bricht auch ab, wenn der Code der APK
 * Klassen von Firebase oder den Google Play Services enthält: Erinnerungen laufen über das eigene
 * Modul `modules/daylight-reminders`, und eine neue Abhängigkeit soll Google nicht unbemerkt
 * zurückbringen.
 *
 *   node .github/scripts/check-manifest.mjs builds/daylight-1.0.11.apk [mapping.txt]
 *
 * Das App Bundle für Play prüft die Pipeline genauso: bundletool macht daraus eine universelle APK
 * (Manifest und Code des Bundles, unsigniert), die dieses Skript bekommt.
 *
 * R8 kürzt die Klassennamen im Code. Mit der Zuordnung von R8 als zweitem Argument sucht die
 * Prüfung auch dort nach den ursprünglichen Namen, sonst fiele eine umbenannte Klasse durch.
 *
 * aapt2 kommt aus dem neuesten `build-tools` unter `ANDROID_HOME`, lokal ersatzweise aus
 * `~/Library/Android/sdk`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HEALTH_PERMISSIONS = [
  'android.permission.health.READ_EXERCISE',
  'android.permission.health.READ_HEALTH_DATA_HISTORY',
  'android.permission.health.READ_RESTING_HEART_RATE',
  'android.permission.health.READ_SLEEP',
  'android.permission.health.READ_STEPS',
];

const apk = process.argv[2];
if (!apk || !existsSync(apk)) {
  console.error('Aufruf: check-manifest.mjs <pfad-zur-apk>');
  process.exit(1);
}

const sdk = process.env.ANDROID_HOME || join(homedir(), 'Library/Android/sdk');
const buildTools = readdirSync(join(sdk, 'build-tools')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const aapt2 = join(sdk, 'build-tools', buildTools.at(-1), 'aapt2');
const dump = (...args) => execFileSync(aapt2, ['dump', ...args, apk], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const badging = dump('badging');
const manifest = dump('xmltree', '--file', 'AndroidManifest.xml');
const app = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8')).expo;

const pkg = badging.match(/^package: .*$/m)?.[0] ?? '';
// `uses-permission-sdk-23` grants the same as `uses-permission`, only from Android 6 on (all of
// Daylight's devices), so both count.
const permissions = [...badging.matchAll(/^uses-permission(?:-sdk-23)?: name='([^']+)'/gm)].map((m) => m[1]);
const health = permissions.filter((p) => p.startsWith('android.permission.health.')).sort();

const problems = [];
if (!pkg.includes(`versionName='${app.version}'`)) problems.push(`versionName passt nicht zu ${app.version}: ${pkg}`);
if (!pkg.includes(`versionCode='${app.android.versionCode}'`)) problems.push(`versionCode passt nicht zu ${app.android.versionCode}: ${pkg}`);
for (const p of permissions) {
  if (/INTERNET|c2dm|badge/i.test(p)) problems.push(`Verbotene Berechtigung: ${p}`);
}
if (health.join() !== HEALTH_PERMISSIONS.join()) {
  problems.push(`Health Connect: erwartet ${HEALTH_PERMISSIONS.join(', ')}, gefunden ${health.join(', ') || 'nichts'}`);
}
// Typnamen stehen im Klartext in der String-Tabelle jeder .dex-Datei.
const dex = execFileSync('unzip', ['-p', apk, 'classes*.dex'], { maxBuffer: 512 * 1024 * 1024 });
const mapping = process.argv[3] ? readFileSync(process.argv[3], 'utf8') : '';
for (const prefix of ['Lcom/google/firebase/', 'Lcom/google/android/gms/']) {
  const name = prefix.slice(1).replaceAll('/', '.');
  // In der Zuordnung beginnt jede Klasse eine Zeile: `com.google.firebase.X -> a.b:`
  if (dex.includes(prefix) || mapping.includes(`\n${name}`) || mapping.startsWith(name)) {
    problems.push(`Google-Bibliothek im Code: ${name.slice(0, -1)}`);
  }
}
if (!/allowBackup\([^)]*\)=(false|\(type 0x12\)0x0)\b/.test(manifest)) problems.push('android:allowBackup ist nicht false');

// allowBackup=false hält ab Android 12 den Umzug von Gerät zu Gerät nicht auf. Die Regeln aus
// plugins/withNoDeviceTransfer.js müssen für Cloud und Umzug jeden internen Speicherbereich
// ausschließen. R8 kürzt die Pfade der Ressourcen, die Datei wird deshalb über ihre id gesucht.
const RULE_DOMAINS = ['root', 'file', 'database', 'sharedpref', 'device_root', 'device_file', 'device_database', 'device_sharedpref'];
const rulesId = manifest.match(/dataExtractionRules\([^)]*\)=@(0x[0-9a-f]+)/)?.[1];
const rulesFile = rulesId && dump('resources').match(new RegExp(`resource ${rulesId} [^\\n]*\\n\\s+\\(\\) \\(file\\) (\\S+)`))?.[1];
if (!rulesFile) {
  problems.push('android:dataExtractionRules fehlt, der Umzug auf ein neues Handy nimmt die Daten mit');
} else {
  const rules = dump('xmltree', '--file', rulesFile);
  for (const section of ['cloud-backup', 'device-transfer']) {
    const body = rules.split(new RegExp(`E: ${section} `))[1]?.split(/\n {4}E: /)[0] ?? '';
    if (!body) problems.push(`dataExtractionRules ohne <${section}>`);
    if (/E: include /.test(body)) problems.push(`dataExtractionRules: <${section}> nimmt Daten mit (include)`);
    const excluded = [...body.matchAll(/domain="([^"]+)"/g)].map((m) => m[1]);
    const missing = RULE_DOMAINS.filter((d) => !excluded.includes(d));
    if (body && missing.length > 0) problems.push(`dataExtractionRules: <${section}> schließt ${missing.join(', ')} nicht aus`);
  }
}

console.log(pkg);
for (const p of permissions) console.log(`uses-permission: ${p}`);

if (problems.length > 0) {
  for (const problem of problems) console.error(`::error::${problem}`);
  process.exit(1);
}
console.log('Manifest in Ordnung: kein INTERNET, keine Cloud-Sicherung, kein Umzug auf ein neues Handy, Health Connect nur lesend, kein Firebase.');
