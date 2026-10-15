// Nimmt Daylight auch vom Umzug auf ein neues Handy aus. android:allowBackup="false" sperrt ab
// Android 12 nur die Cloud-Sicherung, die direkte Übertragung von Gerät zu Gerät (Kabel oder WLAN
// beim Einrichten) kopiert die App-Daten trotzdem. Diese Regeln schließen jeden Speicherbereich für
// beide Wege aus. Bis Android 11 reicht allowBackup="false" allein. Die Daten verlassen das Gerät
// damit nur über eine Sicherung, die man selbst speichert oder teilt. check-manifest.mjs prüft, dass
// die Regeln in der fertigen APK und im App Bundle stehen.
// Siehe docs/development.md (Datenschutz).
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RULES = 'data_extraction_rules';
const DOMAINS = ['root', 'file', 'database', 'sharedpref', 'external', 'device_root', 'device_file', 'device_database', 'device_sharedpref'];

const excludes = DOMAINS.map((domain) => `    <exclude domain="${domain}" path="." />`).join('\n');
const XML = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
${excludes}
  </cloud-backup>
  <device-transfer>
${excludes}
  </device-transfer>
</data-extraction-rules>
`;

function withNoDeviceTransfer(config) {
  config = withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    application.$['android:dataExtractionRules'] = `@xml/${RULES}`;
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const dir = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${RULES}.xml`), XML);
      return mod;
    },
  ]);
}

module.exports = withNoDeviceTransfer;
