import { HOURS, RING, SPIRAL, SUN } from '@/components/ui/logoPaths';
import { CARD_OPACITY, colors, moodColors } from '@/lib/theme/tokens';

import { DESIGNS, markMarkup, motifMarkup, shape, shrunk, type DesignKey, type LogoGeometry, type ShapeName } from './designs';

/**
 * How a design looks inside the app: the glow at the top of every screen, the backdrop behind the
 * content and a few motifs strewn over the top. All of it is decoration that text scrolls over, so
 * each colour is mixed with the page and lowered until every colour of text that sits straight on a
 * page keeps 4.5:1 on it, and so does the text on a translucent card over it (red warnings and the
 * mood colours included; `lib/theme/__tests__/contrast.test.ts`). Cards, accents and mood colours
 * stay as they are.
 */

const LOGO: LogoGeometry = { ring: RING, hours: HOURS, spiral: SPIRAL, sun: SUN };

/** Text straight on a page: title, captions and hints, the eyebrow, the streak at risk, red warnings. */
export const PAGE_TEXT = [colors.text, colors.textMuted, colors.accent, colors.amber, colors.danger] as const;

/** How much of each colour survives the mix with the page, before contrast lowers it further. */
export const INTENSITY = { mark: 0.36, sun: 0.52, motif: 0.44, glow: 1.9 } as const;

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const mix = (c: string, base: string, t: number) => {
  const b = hex(base);
  return toHex(hex(c).map((v, i) => v * t + (b[i] ?? 0) * (1 - t)));
};

function luminance(c: string): number {
  const [r = 0, g = 0, b = 0] = hex(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x = 0, y = 0] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Strong colours on cards: everything on the page and the mood colours. */
const CARD_TEXT = [...PAGE_TEXT, ...Object.values(moodColors).map((mood) => mood.strong)];
const CARD_FILLS = [colors.surface, colors.surfaceMuted, colors.accentSoft];

/** Page text on `c`, and card text on every card fill laid over `c`, keep 4.5:1. */
function readable(c: string): boolean {
  if (PAGE_TEXT.some((text) => contrast(text, c) < 4.5)) return false;
  return CARD_FILLS.every((fill) => {
    const card = mix(fill, c, CARD_OPACITY);
    return CARD_TEXT.every((text) => contrast(text, card) >= 4.5);
  });
}

/** `c` mixed into the page at share `t`, lowered step by step until all page text clears 4.5:1. */
function pale(c: string, t: number): string {
  for (; t > 0.06; t -= 0.01) {
    const m = mix(c, colors.background, t);
    if (readable(m)) return m;
  }
  return mix(c, colors.background, 0.06);
}

/** Pushes a pale glow further from white, as far as the text on it allows. */
function deepen(c: string): string {
  for (let k = INTENSITY.glow; k > 1; k -= 0.05) {
    const g = toHex(hex(c).map((v) => 255 - (255 - v) * k));
    if (readable(g)) return g;
  }
  return c;
}

const paleAll = (markup: string, t: number) => markup.replace(/#[0-9A-Fa-f]{6}\b/g, (c) => pale(c.toUpperCase(), t));

/** One shape strewn over the top of a screen: inner markup for a viewBox of -11 -11 22 22. */
export interface ScatterSpot {
  /** Centre as a share of the window's width and height. */
  x: number;
  y: number;
  /** Edge length, as a share of the window's width. */
  size: number;
  markup: string;
}

export interface Appearance {
  glow: string;
  /** Motifs and shrunk mark in the 108 grid, without ground. */
  backdrop: string;
  scatter: readonly ScatterSpot[];
}

/** Shapes that only make sense in their place round the ring, never strewn about. */
const NOT_STREWN = new Set<ShapeName>(['ray', 'grass']);
/** Where the strewn motifs go: centre x and y as shares of the window, size in px of the preview's screen and turn. */
const SPOTS = [
  [0.84, 0.06, 26, 20],
  [0.1, 0.19, 18, -25],
  [0.6, 0.155, 15, 40],
  [0.93, 0.33, 20, -10],
  [0.05, 0.5, 22, 15],
] as const;
/** The screen of the design preview: a phone frame 232 wide with 6 px of bezel each side. */
const PROTOTYPE_WIDTH = 220;

function build(key: DesignKey): Appearance {
  const design = DESIGNS[key];
  const app = design.app;
  const markColor = app.mark ?? design.ring;
  const sunColor = app.sun ?? design.sun;
  const motifs = design.motifs.map((m) => (app.motif ? { ...m, c: app.motif, c2: app.motif } : m.appC ? { ...m, c: m.appC } : m));

  const markPale = pale(markColor, INTENSITY.mark);
  const sunPale = pale(sunColor, INTENSITY.sun);
  const motifSvg = paleAll(motifs.map(motifMarkup).join(''), INTENSITY.motif);
  // The shapes that replace the sun bring colours of their own (the chick's eye, the pumpkin's face).
  const markSvg = paleAll(markMarkup(LOGO, design, { ring: markPale, spiral: markPale, sun: sunPale }), 1);

  const strewn = app.scatter
    ? [{ s: app.scatter, c: design.sun, c2: undefined, appC: undefined }]
    : design.motifs.filter((m) => m.x === undefined && !NOT_STREWN.has(m.s));
  const scatter = strewn.length
    ? SPOTS.map(([x, y, px, turn], i) => {
        const m = strewn[i % strewn.length]!;
        const c = app.motif ?? m.appC ?? m.c;
        return { x, y, size: px / PROTOTYPE_WIDTH, markup: `<g transform="rotate(${turn})">${paleAll(shape(m.s, c, app.motif ?? m.c2), INTENSITY.motif)}</g>` };
      })
    : [];

  return { glow: deepen(app.glow), backdrop: motifSvg + shrunk(markSvg), scatter };
}

const cache = new Map<DesignKey, Appearance>();

export function appearanceOf(key: DesignKey): Appearance {
  let found = cache.get(key);
  if (!found) {
    found = build(key);
    cache.set(key, found);
  }
  return found;
}

/** Every colour an appearance paints, for the contrast test. */
export function colorsOf(appearance: Appearance): string[] {
  const markup = appearance.backdrop + appearance.scatter.map((spot) => spot.markup).join('');
  return [...new Set([appearance.glow, ...(markup.match(/#[0-9A-F]{6}\b/gi) ?? []).map((c) => c.toUpperCase())])];
}
