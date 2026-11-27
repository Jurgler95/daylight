import type { MoodLevel } from '@/db/schema';

/** Which palette is showing: the light "Sonnenschein" or the dark "Abendhimmel". */
export type ColorScheme = 'light' | 'dark';

/**
 * "Sonnenschein": a bright, cheerful light scheme. Sky blue pages, a clear blue accent and five
 * saturated mood colours from berry to teal. Foreground colours are still dark enough to clear
 * WCAG AA on every surface they are used on; `lib/theme/__tests__/contrast.test.ts` checks every
 * pair the app actually renders, in both schemes.
 */
const light = {
  background: '#F3F8FF',
  surface: '#FFFFFF',
  surfaceMuted: '#E4EFFC',
  border: '#C6DBF5',
  text: '#13213A',
  textMuted: '#475873',
  textOnAccent: '#FFFFFF',
  /** Labels and icons on the saturated gradients (`sunny`, `trophy`), white in both schemes. */
  textOnGradient: '#FFFFFF',
  accent: '#1A5FC2',
  accentSoft: '#DCEAFF',
  danger: '#C0231B',
  // A streak at risk (yesterday missing): a warm amber that asks, never alarms. Text and icons in
  // `amber`, on `amberSoft` or straight on a page or card.
  amber: '#8A4B00',
  amberSoft: '#FFE9C2',
  // Decorative only (the logo backdrop behind every screen): ring and spiral in pastel blue, the sun
  // in pastel yellow. Text scrolls over them, so they are as light as every text colour, the mood
  // colours included, needs for 4.5:1.
  decorMark: '#DDEBFB',
  decorSun: '#FFF0B3',
  // The sky blue glow that fades in from the top of every screen, behind the title. Decorative only.
  glow: '#DDEDFF',
  /** Dims the page behind a sheet or dialog, laid on at 35 to 55 percent. */
  scrim: '#13213A',
  /** The warm corner of the toast that announces a new star. Decorative only. */
  medalSoft: '#FFF4CC',
  /** The knob of a switch, light in both schemes so it stands out on any card. */
  switchThumb: '#FFFFFF',
};

export type Colors = { readonly [K in keyof typeof light]: string };

/**
 * "Abendhimmel": the dark scheme, a deep night blue rather than black, so the cards still float a
 * little above the page and the sky of the light scheme carries on after sunset. Foreground colours
 * turn light and the accent a soft sky blue; on it and on the mood colours sits dark text
 * (`textOnAccent`). The same pairs as in the light scheme clear WCAG AA.
 */
const dark: Colors = {
  background: '#0D1524',
  surface: '#16213A',
  surfaceMuted: '#1C2944',
  border: '#2E4066',
  text: '#E9EFF9',
  textMuted: '#A8B5CC',
  textOnAccent: '#0A1830',
  textOnGradient: '#FFFFFF',
  accent: '#8CB6FF',
  accentSoft: '#1E3358',
  danger: '#FF8F85',
  amber: '#FFC46B',
  amberSoft: '#3B2A10',
  // A shade lighter than the page, and the sun a dim gold, so the backdrop shows without glowing.
  decorMark: '#15223A',
  decorSun: '#231F14',
  glow: '#15243F',
  scrim: '#000000',
  medalSoft: '#3A3012',
  switchThumb: '#E9EFF9',
};

/** Cards are this opaque, so the logo backdrop shows through a little (Zyklus). */
export const CARD_OPACITY = 0.86;

export type MoodColors = Record<MoodLevel, { strong: string; soft: string }>;

/**
 * Per mood level: `strong` for icons, text and year pixels, `soft` as the fill behind a strong icon
 * (calendar day, chip). Meaning never rests on colour alone: every mood also shows its icon.
 */
export const moodColors: MoodColors = {
  5: { strong: '#007060', soft: '#C8F3E3' },
  4: { strong: '#336E08', soft: '#DDF4C2' },
  3: { strong: '#876200', soft: '#FFEC9E' },
  2: { strong: '#B03512', soft: '#FFDCC0' },
  1: { strong: '#9C1C7A', soft: '#F8D8F0' },
};

/**
 * The same five hues for the dark scheme: bright enough to read as text on the night blue, the soft
 * fills deep tints of them. Neighbouring levels stay apart in hue and lightness, so the year in
 * pixels still reads at a glance.
 */
const darkMoodColors: MoodColors = {
  5: { strong: '#4CD6B4', soft: '#103A33' },
  4: { strong: '#9BD66B', soft: '#22381A' },
  3: { strong: '#F0CA4E', soft: '#3A3214' },
  2: { strong: '#FF9A6B', soft: '#40241A' },
  1: { strong: '#F28BD4', soft: '#3B1A35' },
};

type Tile = { strong: string; soft: string };

/**
 * Icon tiles in lists cycle through these, so a settings page reads like a box of crayons rather than
 * a grey column. Icons only, never text; each strong colour clears 3:1 on its soft fill.
 */
export const tileColors: readonly Tile[] = [
  { strong: '#1A5FC2', soft: '#DCEAFF' },
  { strong: '#B03512', soft: '#FFDCC0' },
  { strong: '#876200', soft: '#FFEC9E' },
  { strong: '#336E08', soft: '#DDF4C2' },
  { strong: '#007060', soft: '#C8F3E3' },
  { strong: '#0E6E8C', soft: '#D2F0FA' },
  { strong: '#6A2BB5', soft: '#EADCFF' },
];

const darkTileColors: readonly Tile[] = [
  { strong: '#8CB6FF', soft: '#1E3358' },
  { strong: '#FF9A6B', soft: '#40241A' },
  { strong: '#F0CA4E', soft: '#3A3214' },
  { strong: '#9BD66B', soft: '#22381A' },
  { strong: '#4CD6B4', soft: '#103A33' },
  { strong: '#6FD3F2', soft: '#10323E' },
  { strong: '#C3A0FF', soft: '#2E2150' },
];

/** A cheerful gradient for highlight surfaces (primary button, active tab pill). White text clears 4.5:1 on both ends. */
export const sunnyGradient = ['#1A5FC2', '#00796B'] as const;

/** Gold medal behind the trophy of a new star and the star asking for a rating; decorative, the words carry the meaning. */
export const medalGradient = ['#FFD54A', '#E09B00'] as const;

/** Behind the achievements summary and a finished achievement, blue into the fifth star's violet. White text clears 4.5:1 on both ends. */
export const trophyGradient = ['#1A5FC2', '#6A2BB5'] as const;
/** Secondary text on `trophyGradient`, a touch softer than white. */
export const trophySoftText = '#E3E9F7';

/** Everything that changes with the scheme. The gradients stay saturated in the dark too, with white on them. */
export interface Palette {
  scheme: ColorScheme;
  colors: Colors;
  mood: MoodColors;
  tiles: readonly Tile[];
  gradients: {
    sunny: readonly [string, string];
    trophy: readonly [string, string];
    medal: readonly [string, string];
  };
  trophySoftText: string;
}

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    scheme: 'light',
    colors: light,
    mood: moodColors,
    tiles: tileColors,
    gradients: { sunny: sunnyGradient, trophy: trophyGradient, medal: medalGradient },
    trophySoftText,
  },
  dark: {
    scheme: 'dark',
    colors: dark,
    mood: darkMoodColors,
    tiles: darkTileColors,
    gradients: { sunny: sunnyGradient, trophy: trophyGradient, medal: medalGradient },
    trophySoftText,
  },
};

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
  title: { fontSize: 27, lineHeight: 32, fontWeight: '800', letterSpacing: -0.6 },
  headline: { fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400', letterSpacing: 0 },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '700', letterSpacing: 0 },
  // No positive letter spacing: Android measures text without it and then drops the last letter of short labels ("Te" for "Ter").
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0 },
} as const;

export type TypographyVariant = keyof typeof typography;
