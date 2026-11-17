import { requireOptionalNativeModule } from 'expo';

/**
 * The icon on the home screen, switched between the launcher aliases that
 * `plugins/withSeasonalIcons.js` declares (`android/.../LauncherIcons.kt`). The switch itself
 * happens natively once no activity of the app is visible. Null where the native module is
 * missing: iOS, the web, Expo Go and Jest.
 */
export interface DaylightLauncherModule {
  /** The enabled alias, `'logo'` or a design key; null when none or several are on. */
  current(): string | null;
  /** The icon to switch to the next time the app is out of sight. Throws for a key without an alias. */
  setTarget(key: string): void;
  /** True while a system screen the app opened is in front: no switch until the next time. */
  setHeld(held: boolean): void;
}

export default requireOptionalNativeModule<DaylightLauncherModule>('DaylightLauncher');
