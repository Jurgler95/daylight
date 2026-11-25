// Gibt den nativen Teilen von Android die Farben der App, hell und dunkel (values und values-night):
// Akzent für Knöpfe in Alerts und für Datums- und Uhrzeitwahl, die Kartenfarbe als Grund der Dialoge
// und die Seitenfarbe als Fensterhintergrund, damit zwischen Splash und erstem Bild nichts weiß
// aufblitzt. Welches Schema gilt, bestimmt AppCompat (Einstellung "Erscheinungsbild" über
// Appearance.setColorScheme oder das System). Die Werte stehen in lib/theme/tokens.ts,
// lib/theme/__tests__/nativeColors.test.ts hält beide gleich.
const { withAndroidColors, withAndroidColorsNight, withAndroidStyles, AndroidConfig } = require('expo/config-plugins');

const COLORS = {
  light: { daylight_accent: '#1A5FC2', daylight_surface: '#FFFFFF', daylight_background: '#F3F8FF' },
  dark: { daylight_accent: '#8CB6FF', daylight_surface: '#16213A', daylight_background: '#0D1524' },
};

const ITEMS = {
  colorAccent: '@color/daylight_accent',
  'android:colorAccent': '@color/daylight_accent',
  'android:colorBackgroundFloating': '@color/daylight_surface',
  'android:windowBackground': '@color/daylight_background',
};

function setColors(modResults, colors) {
  let res = modResults;
  for (const [name, value] of Object.entries(colors)) {
    res = AndroidConfig.Colors.setColorItem(AndroidConfig.Resources.buildResourceItem({ name, value }), res);
  }
  return res;
}

function withThemeColors(config) {
  config = withAndroidColors(config, (mod) => {
    mod.modResults = setColors(mod.modResults, COLORS.light);
    return mod;
  });
  config = withAndroidColorsNight(config, (mod) => {
    mod.modResults = setColors(mod.modResults, COLORS.dark);
    return mod;
  });
  return withAndroidStyles(config, (mod) => {
    for (const [name, value] of Object.entries(ITEMS)) {
      mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, {
        add: true,
        parent: AndroidConfig.Styles.getAppThemeGroup(),
        name,
        value,
      });
    }
    return mod;
  });
}

module.exports = withThemeColors;
module.exports.COLORS = COLORS;
