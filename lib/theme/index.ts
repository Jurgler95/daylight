import { colors, type Colors } from './tokens';

export * from './tokens';

export interface Theme {
  colors: Colors;
}

const theme: Theme = { colors };

/** Appends an alpha channel to an opaque `#RRGGBB` colour. `alpha` is 0..1. */
export function withAlpha(hex: string, alpha: number): string {
  const channel = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${channel}`;
}

/** The app ships one light theme, so this is a plain accessor rather than a context. */
export function useTheme(): Theme {
  return theme;
}
