// Lässt den Datenschutz-Link im Berechtigungsdialog von Health Connect direkt die Seite
// „Datenschutz" öffnen. Das Plugin von react-native-health-connect richtet den Rationale-Intent
// (bis Android 13) und den Alias ViewPermissionUsageActivity (ab Android 14) auf MainActivity, die
// dann nur die zuletzt offene Seite zeigt. Play verlangt dort die Datenschutzerklärung. Dieses
// Plugin hängt beides an PrivacyPolicyActivity aus modules/daylight-reminders, die
// daylight://more/privacy an MainActivity weiterreicht und sich schließt.
//
// Muss in app.json direkt vor "react-native-health-connect" stehen: Manifest-Mods laufen in
// umgekehrter Reihenfolge der Plugins, so läuft dieser nach dem von Health Connect und findet Filter
// und Alias schon vor. Fehlen sie, bricht der Build ab, statt den Link still auf der falschen Seite
// zu lassen.
// Siehe docs/decisions/gesundheitsdaten-health-connect.md.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const RATIONALE_ACTION = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';
const ALIAS = 'ViewPermissionUsageActivity';
const ACTIVITY = 'de.behla.daylight.reminders.PrivacyPolicyActivity';

const hasRationale = (filter) => (filter.action ?? []).some((a) => a.$['android:name'] === RATIONALE_ACTION);

function withHealthPrivacyPolicy(config) {
  return withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    const main = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);

    const filters = main['intent-filter'] ?? [];
    const rationale = filters.filter(hasRationale);
    const alias = (application['activity-alias'] ?? []).find((a) => a.$['android:name'] === ALIAS);
    if (rationale.length === 0 || !alias) {
      throw new Error(
        'withHealthPrivacyPolicy: Rationale-Intent oder ViewPermissionUsageActivity fehlt, steht das Plugin in app.json vor react-native-health-connect?',
      );
    }
    main['intent-filter'] = filters.filter((f) => !hasRationale(f));

    // Exportiert, damit Health Connect sie starten kann. Ohne Anzeige, sie gibt nur den Link weiter.
    application.activity = (application.activity ?? []).filter((a) => a.$['android:name'] !== ACTIVITY);
    application.activity.push({
      $: {
        'android:name': ACTIVITY,
        'android:exported': 'true',
        'android:excludeFromRecents': 'true',
        'android:noHistory': 'true',
        'android:theme': '@android:style/Theme.NoDisplay',
      },
      'intent-filter': [{ action: [{ $: { 'android:name': RATIONALE_ACTION } }] }],
    });
    // Ein Alias muss nach seinem Ziel im Manifest stehen. Alle <activity> werden vor den
    // <activity-alias> geschrieben, und die Aktivität steht im App-Manifest, nicht erst im
    // zusammengeführten aus dem Modul.
    alias.$['android:targetActivity'] = ACTIVITY;
    return mod;
  });
}

module.exports = withHealthPrivacyPolicy;
