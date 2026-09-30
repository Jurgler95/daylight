import type { MoodLevel } from '@/db/schema';

/**
 * "Sonnenschein": a bright, cheerful light scheme. Sky blue pages, a clear blue accent and five
 * saturated mood colours from berry to teal. Foreground colours are still dark enough to clear
 * WCAG AA on every surface they are used on; `lib/theme/__tests__/contrast.test.ts` checks every
 * pair the app actually renders.
 */
export const colors = {
  background: '#F3F8FF',
  surface: '#FFFFFF',
  surfaceMuted: '#E4EFFC',
  border: '#C6DBF5',
  text: '#13213A',
  textMuted: '#475873',
  textOnAccent: '#FFFFFF',
  accent: '#1A5FC2',
  accentSoft: '#DCEAFF',
  danger: '#C0231B',
  // Decorative only (the logo backdrop behind every screen): ring and spiral in pastel blue, the sun
  // in pastel yellow. Text scrolls over them, so they are as light as every text colour, the mood
  // colours included, needs for 4.5:1.
  decorMark: '#DDEBFB',
  decorSun: '#FFF0B3',
  // The sky blue glow that fades in from the top of every screen, behind the title. Decorative only.
  glow: '#DDEDFF',
} as const;

export type Colors = typeof colors;

/** Cards are this opaque, so the logo backdrop shows through a little (Zyklus). */
export const CARD_OPACITY = 0.86;

/**
 * Per mood level: `strong` for icons, text and year pixels, `soft` as the fill behind a strong icon
 * (calendar day, chip). Meaning never rests on colour alone: every mood also shows its icon.
 */
export const moodColors: Record<MoodLevel, { strong: string; soft: string }> = {
  5: { strong: '#007060', soft: '#C8F3E3' },
  4: { strong: '#336E08', soft: '#DDF4C2' },
  3: { strong: '#876200', soft: '#FFEC9E' },
  2: { strong: '#B03512', soft: '#FFDCC0' },
  1: { strong: '#9C1C7A', soft: '#F8D8F0' },
};

/**
 * Icon tiles in lists cycle through these, so a settings page reads like a box of crayons rather than
 * a grey column. Icons only, never text; each strong colour clears 3:1 on its soft fill.
 */
export const tileColors: readonly { strong: string; soft: string }[] = [
  { strong: '#1A5FC2', soft: '#DCEAFF' },
  { strong: '#B03512', soft: '#FFDCC0' },
  { strong: '#876200', soft: '#FFEC9E' },
  { strong: '#336E08', soft: '#DDF4C2' },
  { strong: '#007060', soft: '#C8F3E3' },
  { strong: '#0E6E8C', soft: '#D2F0FA' },
  { strong: '#6A2BB5', soft: '#EADCFF' },
];

/** A cheerful gradient for highlight surfaces (primary button, active tab pill). White text clears 4.5:1 on both ends. */
export const sunnyGradient = ['#1A5FC2', '#00796B'] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 28,
  pill: 999,
} as const;

/** Minimum size for any interactive element (WCAG / platform guidance). */
export const TOUCH_TARGET = 44;

export const typography = {
  display: { fontSize: 42, lineHeight: 46, fontWeight: '800', letterSpacing: -1 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6 },
  headline: { fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400', letterSpacing: 0 },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '700', letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.2 },
} as const;

export type TypographyVariant = keyof typeof typography;
