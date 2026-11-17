// Die Aliase des Icons auf dem Startbildschirm, eine Stelle für die Namensregel: das Logo und je Design
// zur Jahreszeit aus lib/seasons/designs.ts ein Alias `.launcher.<schlüssel>`, also etwa
// de.behla.daylight.launcher.herbst. Der Schlüssel steht unverändert im Namen, so reicht JS ihn an
// modules/daylight-launcher weiter, ohne Groß- und Kleinschreibung umzurechnen; das Kotlin-Modul
// sucht dasselbe Präfix (ALIAS_PREFIX in LauncherIcons.kt, lib/seasons/__tests__/launcher.test.ts
// prüft, dass beide gleich sind).
//
// Die Liste darf nur wachsen. Ein Gerät, auf dem ein Alias eingeschaltet ist, verlöre mit einem Update
// ohne diesen Alias sein Icon auf dem Startbildschirm und käme dann nicht mehr an die App, die das
// reparieren könnte. Fällt ein Design weg, bleibt sein Alias mit seinen Bildern hier stehen.
const ALIAS_PREFIX = '.launcher.';
const LOGO = 'logo';

const LAUNCHER_ALIASES = [LOGO, 'fruehling', 'sommer', 'herbst', 'winter', 'ostern', 'halloween', 'weihnachten', 'silvester', 'neujahrsfest'];

const aliasName = (key) => `${ALIAS_PREFIX}${key}`;

module.exports = { ALIAS_PREFIX, LOGO, LAUNCHER_ALIASES, aliasName };
