import { palettes } from '../tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { COLORS } = require('../../../plugins/withThemeColors') as {
  COLORS: Record<'light' | 'dark', { daylight_accent: string; daylight_surface: string; daylight_background: string }>;
};

describe('native theme colours (plugins/withThemeColors.js)', () => {
  it.each(['light', 'dark'] as const)('match the %s palette', (scheme) => {
    const { colors } = palettes[scheme];
    expect(COLORS[scheme]).toEqual({ daylight_accent: colors.accent, daylight_surface: colors.surface, daylight_background: colors.background });
  });
});
