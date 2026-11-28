// Meldet React Native das Ende der alten Activity sofort, damit Ordnerwähler und andere
// Systemwähler auch nach einer Konfigurationsänderung (Schriftgröße, Sprache, Anzeigegröße) öffnen.
//
// Ablauf ohne dieses Plugin: Android baut MainActivity neu auf. Expos ReactActivityDelegateWrapper
// schiebt onDestroy der alten Activity per Coroutine auf Dispatchers.Main nach hinten, onResume der
// neuen läuft auf Main.immediate sofort. Dadurch ist die neue Activity schon "current", wenn
// ReactHost.onHostDestroy(alt) ankommt, und der Aufruf verpufft (Identitätsvergleich). Expos
// AppContext erfährt nie vom Ende, setzt hostWasDestroyed nicht und registriert die Activity-Result-
// Verträge nicht neu. Die Registry hat den Launcher von expo-file-system beim ON_DESTROY der alten
// Activity aber schon abgemeldet, also wirft pickDirectoryAsync "Attempting to launch an
// unregistered ActivityResultLauncher". Betroffen ist alles, was registerForActivityResult nutzt
// (Directory.pickDirectoryAsync, expo-image-picker), nicht expo-document-picker.
//
// Der Aufruf hier läuft synchron, solange die alte Activity noch current ist. Der spätere Aufruf
// des Wrappers trifft dann eine andere Activity und tut nichts.
const { withMainActivity } = require('expo/config-plugins');

const MARKER = '// withSyncHostDestroy';
const IMPORT = 'import com.facebook.react.ReactApplication';
const OVERRIDE = `
  ${MARKER}: ReactHost sofort über das Ende dieser Activity informieren, siehe plugins/withSyncHostDestroy.js.
  override fun onDestroy() {
    (application as ReactApplication).reactHost?.onHostDestroy(this)
    super.onDestroy()
  }

`;

function withSyncHostDestroy(config) {
  return withMainActivity(config, (mod) => {
    if (mod.modResults.language !== 'kt') throw new Error('withSyncHostDestroy: MainActivity ist nicht in Kotlin');
    let src = mod.modResults.contents;
    if (src.includes(MARKER)) return mod;
    if (/override fun onDestroy\(/.test(src)) throw new Error('withSyncHostDestroy: MainActivity hat schon ein onDestroy, bitte das Plugin anpassen');

    const classStart = /class MainActivity\s*:\s*ReactActivity\(\)\s*\{\n/;
    if (!classStart.test(src)) throw new Error('withSyncHostDestroy: MainActivity hat nicht die erwartete Form');
    if (!src.includes(IMPORT)) src = src.replace(/(import com\.facebook\.react\.ReactActivity\n)/, `$1${IMPORT}\n`);
    if (!src.includes(IMPORT)) throw new Error('withSyncHostDestroy: Import ließ sich nicht einfügen');
    src = src.replace(classStart, (head) => head + OVERRIDE);
    mod.modResults.contents = src;
    return mod;
  });
}

module.exports = withSyncHostDestroy;
