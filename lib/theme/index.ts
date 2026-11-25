import { createContext, use } from 'react';

import { palettes, type ColorScheme, type Palette } from './tokens';

export * from './tokens';

/** The palette of the current scheme: colours, mood and tile colours, gradients. */
export type Theme = Palette;

/**
 * Set once in the root layout (`ThemeProvider` in `./ThemeProvider.tsx`). Without a provider, as in
 * most tests, the light scheme.
 */
export const ThemeContext = createContext<Theme>(palettes.light);

/** Appends an alpha channel to an opaque `#RRGGBB` colour. `alpha` is 0..1. */
export function withAlpha(hex: string, alpha: number): string {
  const channel = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${channel}`;
}

/** The palette of the scheme on screen, light or dark. */
export function useTheme(): Theme {
  return use(ThemeContext);
}

/** What the user chose under "Mehr": a fixed scheme, or null to follow the device. */
export type SchemePreference = ColorScheme | null;

/** The scheme to show: the user's choice, else the device's, light when the device says nothing. */
export function resolveScheme(preference: SchemePreference, device: string | null | undefined): ColorScheme {
  if (preference) return preference;
  return device === 'dark' ? 'dark' : 'light';
}
