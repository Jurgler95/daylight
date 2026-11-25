// Lässt das Baseline-Profil (assets/dexopt/baseline.prof und .profm) aus der APK weg. AGP setzt es
// aus den Profilen der AndroidX-Bibliotheken zusammen, und die Datei fällt nicht bei jedem Build
// gleich aus. Für einen reproduzierbaren Build, den F-Droid gegen die signierte APK aus dem
// GitHub-Release vergleicht, muss jedes Byte gleich sein. Ohne Profil startet die App beim ersten
// Mal nach einer Installation minimal langsamer, bis Android sie selbst optimiert hat.
// Siehe docs/decisions/f-droid.md.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// Daylight: ohne Baseline-Profil';
const BLOCK = `
${MARKER}, siehe plugins/withoutBaselineProfile.js
tasks.configureEach { task ->
    if (task.name.contains('ArtProfile')) {
        task.enabled = false
    }
}
`;

function withoutBaselineProfile(config) {
  return withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes(MARKER)) mod.modResults.contents += BLOCK;
    return mod;
  });
}

module.exports = withoutBaselineProfile;
