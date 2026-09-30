import { MOOD_LEVELS } from '@/db/schema';

import { CARD_OPACITY, colors, moodColors, sunnyGradient, tileColors, typography, TOUCH_TARGET, type Colors } from '../tokens';

/** WCAG relative luminance and contrast ratio for opaque colours. */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** The opaque colour `top` at `alpha` shows over `bottom`, as the screen composites it. */
function over(top: string, alpha: number, bottom: string): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) => Math.round(channel(top, i) * alpha + channel(bottom, i) * (1 - alpha)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** What can lie under text that sits directly on a screen: the page itself, the logo backdrop or the top glow. */
const PAGE: (keyof Colors)[] = ['background', 'decorMark', 'decorSun', 'glow'];
/** Card fills; cards are translucent (`CARD_OPACITY`), so each is checked over everything on `PAGE`. */
const CARD_TONES: (keyof Colors)[] = ['surface', 'surfaceMuted', 'accentSoft'];

/** Every foreground/background pair the app actually renders, with the size class it is used at. */
const PAIRS: { fg: keyof Colors; bg: keyof Colors; large?: boolean }[] = [
  { fg: 'text', bg: 'background' },
  { fg: 'text', bg: 'surface' },
  { fg: 'text', bg: 'surfaceMuted' },
  { fg: 'text', bg: 'accentSoft' },
  { fg: 'textMuted', bg: 'background' },
  { fg: 'textMuted', bg: 'surface' },
  { fg: 'textMuted', bg: 'surfaceMuted' },
  { fg: 'textMuted', bg: 'accentSoft' },
  { fg: 'textOnAccent', bg: 'accent' },
  { fg: 'textOnAccent', bg: 'text' },
  { fg: 'textOnAccent', bg: 'danger' },
  { fg: 'accent', bg: 'background' },
  { fg: 'accent', bg: 'surface' },
  { fg: 'accent', bg: 'surfaceMuted' },
  { fg: 'accent', bg: 'accentSoft' },
  { fg: 'danger', bg: 'surface' },
  { fg: 'danger', bg: 'background' },
];

describe('colour palette', () => {
  it.each(PAIRS)('$fg on $bg meets WCAG AA', ({ fg, bg, large }) => {
    const ratio = contrastRatio(colors[fg], colors[bg]);
    expect(ratio).toBeGreaterThanOrEqual(large ? 3 : 4.5);
  });

  it.each(PAIRS.filter((pair) => pair.bg === 'background'))('$fg stays readable over the logo backdrop', ({ fg, large }) => {
    for (const bg of PAGE) expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(large ? 3 : 4.5);
  });

  it.each(PAIRS.filter((pair) => CARD_TONES.includes(pair.bg)))('$fg on a translucent $bg card meets WCAG AA over the backdrop', ({ fg, bg, large }) => {
    for (const page of PAGE) {
      expect(contrastRatio(colors[fg], over(colors[bg], CARD_OPACITY, colors[page]))).toBeGreaterThanOrEqual(large ? 3 : 4.5);
    }
  });

  it('keeps the logo backdrop faint but not invisible', () => {
    for (const decor of ['decorMark', 'decorSun', 'glow'] as const) {
      const ratio = contrastRatio(colors[decor], colors.background);
      expect(ratio).toBeGreaterThan(1.05);
      expect(ratio).toBeLessThan(1.2);
    }
  });

  it('keeps non-text markers visible against their background', () => {
    // Calendar dots and bars carry meaning, so they need at least the 3:1 of a graphical object.
    expect(contrastRatio(colors.accent, colors.accentSoft)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(colors.border, colors.surface)).toBeGreaterThanOrEqual(1.2);
  });
});

describe('bright extras', () => {
  it.each(tileColors.map((tile, index) => ({ index, ...tile })))('icon tile $index stays visible on its fill', ({ strong, soft }) => {
    expect(contrastRatio(strong, soft)).toBeGreaterThanOrEqual(3);
  });

  it.each([...sunnyGradient])('white label reads on the gradient stop %s', (stop) => {
    expect(contrastRatio(colors.textOnAccent, stop)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('mood colours', () => {
  it.each(MOOD_LEVELS)('level %i: strong colour works as text on every surface, over the backdrop and on its soft fill', (level) => {
    const { strong, soft } = moodColors[level];
    const pages = PAGE.map((page) => colors[page]);
    const cards = CARD_TONES.flatMap((tone) => pages.map((page) => over(colors[tone], CARD_OPACITY, page)));
    for (const bg of [colors.surface, colors.surfaceMuted, soft, ...pages, ...cards]) {
      expect(contrastRatio(strong, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(MOOD_LEVELS)('level %i: white icon on the strong colour and body text on the soft fill', (level) => {
    const { strong, soft } = moodColors[level];
    expect(contrastRatio(colors.textOnAccent, strong)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.text, soft)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps neighbouring levels apart', () => {
    // Pixels and calendar days sit side by side; adjacent levels must not collapse into one colour.
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (const level of [1, 2, 3, 4] as const) {
      const a = rgb(moodColors[level].strong);
      const b = rgb(moodColors[(level + 1) as 2 | 3 | 4 | 5].strong);
      expect(Math.hypot(...a.map((v, i) => v - (b[i] ?? 0)))).toBeGreaterThanOrEqual(50);
    }
  });
});

describe('type and touch targets', () => {
  it('never uses text below 12px', () => {
    for (const variant of Object.values(typography)) expect(variant.fontSize).toBeGreaterThanOrEqual(12);
  });

  it('keeps the minimum touch target at 44', () => {
    expect(TOUCH_TARGET).toBeGreaterThanOrEqual(44);
  });
});
