import { requireOptionalNativeModule } from 'expo';

/**
 * Hands Android the scheme the user chose, so the splash screen of the next cold start matches it
 * (`android/.../DaylightThemeModule.kt`, Android 12 and later), and keeps the buttons of the
 * navigation bar readable when the scheme changes while the app is open. Null where the native module is
 * missing: iOS, the web, Expo Go and Jest.
 */
export interface DaylightThemeModule {
  /** `'light'`, `'dark'` or `'system'`. */
  setNightMode(scheme: 'light' | 'dark' | 'system'): void;
  /** Light buttons in the navigation bar for the dark scheme, dark ones for the light. */
  setDarkBars(dark: boolean): void;
}

export default requireOptionalNativeModule<DaylightThemeModule>('DaylightTheme');
