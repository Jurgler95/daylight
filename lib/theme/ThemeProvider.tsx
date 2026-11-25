import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider, type Theme as NavigationTheme } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import { useEffect, type PropsWithChildren } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { useSettingsStore } from '@/lib/store/settingsStore';
import NativeTheme from '@/modules/daylight-theme';

import { resolveScheme, ThemeContext, type SchemePreference } from './index';
import { palettes, type ColorScheme } from './tokens';

/**
 * The user's choice under "Mehr" › "Design" › "Erscheinungsbild", null to follow the device, and
 * undefined until the settings are loaded (the app then follows the device, but leaves the native
 * side alone, so a fixed choice is not reset on every cold start).
 */
export function useSchemePreference(): SchemePreference | undefined {
  return useSettingsStore((s) => (s.settings ? s.settings.color_scheme : undefined));
}

/**
 * Hands the native side the user's choice: Android then draws alerts, the date and time pickers and
 * other system dialogs of the app in the same scheme, and `useColorScheme` reports it. "System"
 * gives control back to the device, which may switch while the app is open. From Android 12 the
 * system also remembers it for the splash screen of the next cold start (`modules/daylight-theme`).
 */
function applyNative(preference: SchemePreference) {
  try {
    Appearance.setColorScheme(preference ?? 'unspecified');
    NativeTheme?.setNightMode(preference ?? 'system');
  } catch {
    // Not available in every environment (tests, web); the palette below works without it.
  }
}

function navigationTheme(scheme: ColorScheme): NavigationTheme {
  const { colors } = palettes[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };
}

/**
 * Picks light or dark from the setting and the device, once for the whole app (root layout). The
 * root view behind every screen takes the page colour, so neither a screen transition nor the
 * keyboard flashes white in the dark scheme.
 */
export function ThemeProvider({ children }: PropsWithChildren) {
  const preference = useSchemePreference();
  const device = useColorScheme();
  const scheme = resolveScheme(preference ?? null, device);
  const background = palettes[scheme].colors.background;

  useEffect(() => {
    if (preference !== undefined) applyNative(preference);
  }, [preference]);
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(background).catch(() => {});
    try {
      NativeTheme?.setDarkBars(scheme === 'dark');
    } catch {
      // Without the native module (tests, Expo Go) the bars keep what the system gave them.
    }
  }, [background, scheme]);

  return (
    <ThemeContext value={palettes[scheme]}>
      <NavigationThemeProvider value={navigationTheme(scheme)}>{children}</NavigationThemeProvider>
    </ThemeContext>
  );
}
