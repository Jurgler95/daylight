// Signiert Release-Builds mit dem eigenen Schlüssel, sobald DAYLIGHT_KEYSTORE gesetzt ist. Ohne die
// Variable bleibt es beim Debug-Keystore der Vorlage, damit lokale Probebuilds weiter laufen. Die
// Pipeline setzt die Variable immer und prüft den Fingerabdruck der fertigen APK. Keystore und
// Passwörter liegen nie im Repo, siehe README unter "Signatur".
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_CONFIG = `
        release {
            if (System.getenv('DAYLIGHT_KEYSTORE')) {
                storeFile file(System.getenv('DAYLIGHT_KEYSTORE'))
                storePassword System.getenv('DAYLIGHT_KEYSTORE_PASSWORD')
                keyAlias System.getenv('DAYLIGHT_KEY_ALIAS')
                keyPassword System.getenv('DAYLIGHT_KEY_PASSWORD')
            }
        }`;

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes("System.getenv('DAYLIGHT_KEYSTORE')")) return mod;

    const debugConfig = /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/;
    const releaseType = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!debugConfig.test(gradle) || !releaseType.test(gradle)) {
      throw new Error('withReleaseSigning: build.gradle hat nicht die erwartete Form, bitte das Plugin anpassen');
    }
    gradle = gradle.replace(debugConfig, `$1${RELEASE_CONFIG}`);
    gradle = gradle.replace(
      releaseType,
      "$1signingConfig System.getenv('DAYLIGHT_KEYSTORE') ? signingConfigs.release : signingConfigs.debug",
    );
    mod.modResults.contents = gradle;
    return mod;
  });
}

module.exports = withReleaseSigning;
