// android.blockedPermissions aus app.json entfernt nur <uses-permission>. Eine Bibliothek, die
// dieselbe Berechtigung als <uses-permission-sdk-23> anfordert, bekäme sie trotzdem, denn ab
// Android 6 (alle Geräte von Daylight) wirkt beides gleich. Dieses Plugin setzt für jede gesperrte
// Berechtigung auch dort tools:node="remove". check-manifest.mjs prüft beide Formen in der fertigen
// APK und im App Bundle.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const SDK_23 = 'uses-permission-sdk-23';

function withBlockedPermissionsSdk23(config) {
  const blocked = config.android?.blockedPermissions ?? [];
  if (blocked.length === 0) return config;
  return withAndroidManifest(config, (mod) => {
    const manifest = AndroidConfig.Manifest.ensureToolsAvailable(mod.modResults);
    const names = blocked.map((p) => (p.includes('.') ? p : `android.permission.${p}`));
    const kept = (manifest.manifest[SDK_23] ?? []).filter((p) => !names.includes(p.$['android:name']));
    manifest.manifest[SDK_23] = [...kept, ...names.map((name) => ({ $: { 'android:name': name, 'tools:node': 'remove' } }))];
    mod.modResults = manifest;
    return mod;
  });
}

module.exports = withBlockedPermissionsSdk23;
