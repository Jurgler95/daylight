// Gibt Daylight je Design zur Jahreszeit ein eigenes Icon auf dem Startbildschirm. Für jeden Eintrag
// in plugins/launcherAliases.js entsteht eine activity-alias auf MainActivity (`.launcher.logo`,
// `.launcher.herbst`, ...) mit eigenem Adaptive Icon; der LAUNCHER-Intent-Filter wandert von
// MainActivity auf die Aliase. Nur `.launcher.logo` ist ab Werk an, modules/daylight-launcher
// schaltet um. Alles andere (Deep Links, Health Connect, Benachrichtigungen)
// zielt weiter auf MainActivity.
//
// Die Ebenen erzeugt `node scripts/logo.mjs` nach assets/launcher/<schlüssel>-foreground.png und
// -background.png; der Monochrom-Layer ist der des Logos, den Expo aus app.json erzeugt. Fehlt ein
// Bild, bricht der Build ab, statt ein Alias ohne Icon zu bauen.
const { existsSync, mkdirSync, copyFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const { LAUNCHER_ALIASES, LOGO, aliasName } = require('./launcherAliases');

const LAUNCHER_DIR = 'assets/launcher';
const MAIN = 'android.intent.action.MAIN';
const LAUNCHER = 'android.intent.category.LAUNCHER';

/** Alle Aliase außer dem Logo bringen ihr eigenes Adaptive Icon mit. */
const DESIGN_ALIASES = LAUNCHER_ALIASES.filter((key) => key !== LOGO);

const isLauncher = (filter) =>
  (filter.action ?? []).some((a) => a.$['android:name'] === MAIN) && (filter.category ?? []).some((c) => c.$['android:name'] === LAUNCHER);

function withLauncherAliases(config) {
  return withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    const main = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    const filters = main['intent-filter'] ?? [];
    if (!filters.some(isLauncher)) throw new Error('withSeasonalIcons: MainActivity hat keinen LAUNCHER-Intent-Filter');
    main['intent-filter'] = filters.filter((f) => !isLauncher(f));

    const alias = (name, icon, roundIcon, enabled) => ({
      $: {
        'android:name': name,
        'android:targetActivity': main.$['android:name'],
        'android:exported': 'true',
        'android:enabled': String(enabled),
        'android:icon': icon,
        'android:roundIcon': roundIcon,
        'android:label': '@string/app_name',
      },
      'intent-filter': [{ action: [{ $: { 'android:name': MAIN } }], category: [{ $: { 'android:name': LAUNCHER } }] }],
    });
    // Das Logo behält die Icons, die Expo aus app.json erzeugt; jedes Design bringt ein Adaptive Icon für beide Formen.
    const ours = [
      alias(aliasName(LOGO), '@mipmap/ic_launcher', '@mipmap/ic_launcher_round', true),
      ...DESIGN_ALIASES.map((key) => alias(aliasName(key), `@mipmap/ic_launcher_${key}`, `@mipmap/ic_launcher_${key}`, false)),
    ];
    const names = new Set(ours.map((a) => a.$['android:name']));
    application['activity-alias'] = [...(application['activity-alias'] ?? []).filter((a) => !names.has(a.$['android:name'])), ...ours];
    return mod;
  });
}

function withLauncherResources(config) {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const { projectRoot, platformProjectRoot } = mod.modRequest;
      const res = join(platformProjectRoot, 'app/src/main/res');
      const drawables = join(res, 'drawable-nodpi');
      const adaptive = join(res, 'mipmap-anydpi-v26');
      mkdirSync(drawables, { recursive: true });
      mkdirSync(adaptive, { recursive: true });
      for (const key of DESIGN_ALIASES) {
        for (const layer of ['foreground', 'background']) {
          const source = join(projectRoot, LAUNCHER_DIR, `${key}-${layer}.png`);
          if (!existsSync(source)) throw new Error(`withSeasonalIcons: ${source} fehlt, node scripts/logo.mjs laufen lassen`);
          copyFileSync(source, join(drawables, `ic_launcher_${key}_${layer}.png`));
        }
        writeFileSync(
          join(adaptive, `ic_launcher_${key}.xml`),
          `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_${key}_background"/>
    <foreground android:drawable="@drawable/ic_launcher_${key}_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`,
        );
      }
      return mod;
    },
  ]);
}

module.exports = (config) => withLauncherResources(withLauncherAliases(config));
