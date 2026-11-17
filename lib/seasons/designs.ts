/**
 * The nine seasonal designs, shared by the app (backdrop, glow, `appearance.ts`) and the Node
 * scripts (launcher and store icons, `scripts/logo.mjs`). Pure TypeScript without imports: Node
 * loads this file as it is and strips the types (`scripts/seasons.mjs`).
 *
 * Everything lives in the 108 × 108 grid of an Android adaptive icon. Ring, hour dots, spiral and
 * sun are not copied here: callers pass the logo geometry, the app from `components/ui/logoPaths.ts`,
 * the scripts straight from `assets/logo.svg`.
 */

export const SEASON_KEYS = ['fruehling', 'sommer', 'herbst', 'winter'] as const;
export const FESTIVAL_KEYS = ['ostern', 'halloween', 'weihnachten', 'silvester', 'neujahrsfest'] as const;
export const DESIGN_KEYS = [...SEASON_KEYS, ...FESTIVAL_KEYS] as const;

export type SeasonKey = (typeof SEASON_KEYS)[number];
export type FestivalKey = (typeof FESTIVAL_KEYS)[number];
export type DesignKey = SeasonKey | FestivalKey;

export function isDesignKey(value: unknown): value is DesignKey {
  return (DESIGN_KEYS as readonly unknown[]).includes(value);
}

/** Ring, hour dots, spiral and sun of the logo, as `logoPaths.ts` exports them. */
export interface LogoGeometry {
  ring: { d: string; width: number };
  hours: readonly { cx: number; cy: number; r: number; opacity: number }[];
  spiral: { d: string; width: number };
  sun: { cx: number; cy: number; r: number };
}

const CENTER = 54;
/** The mark shrinks to this share, so the motifs fit between it and the round launcher mask. */
export const MARK_SCALE = 0.78;

// ---------------------------------------------------------------------------------------------
// Motif shapes, drawn around (0, 0), roughly ±10 units before `size`.

const MAPLE =
  'M0 -10 L1.8 -5.5 L4.6 -6.8 L3.8 -2.4 L8.6 -3.6 L6.8 -0.6 L9 1.2 L4.2 2.4 L4.8 5.6 L1 3.8 L0.6 9 L-0.6 9 L-1 3.8 L-4.8 5.6 L-4.2 2.4 L-9 1.2 L-6.8 -0.6 L-8.6 -3.6 L-3.8 -2.4 L-4.6 -6.8 L-1.8 -5.5 Z';
const OVAL = 'M0 -6 C3.4 -3 3.4 3 0 6 C-3.4 3 -3.4 -3 0 -6 Z';

function starPath(outer: number, inner: number, points = 5): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

const radial = (n: number, fn: (deg: number) => string) => Array.from({ length: n }, (_, i) => fn((360 / n) * i)).join('');
const rot = (deg: number, inner: string) => `<g transform="rotate(${deg})">${inner}</g>`;

/** Each shape takes its main colour `c` and, where it has one, a second colour `c2`. */
export const SHAPES = {
  maple: (c: string) => `<path d="${MAPLE}" fill="${c}" stroke="${c}" stroke-width="1.2" stroke-linejoin="round"/>`,
  oval: (c: string) => `<path d="${OVAL}" fill="${c}"/>`,
  blossom: (c: string, c2 = '#F2C14E') =>
    radial(5, (a) => rot(a, `<circle cx="0" cy="-4.2" r="3.4" fill="${c}"/>`)) + `<circle r="2" fill="${c2}"/>`,
  tulip: (c: string, c2 = '#4E8B3A') =>
    `<path d="M0 2 L0 10" stroke="${c2}" stroke-width="1.5" stroke-linecap="round"/>` +
    `<path d="M0 8 C-1 5 -4 4 -6 4.5 C-4 7.5 -2 8.5 0 8.5 Z" fill="${c2}"/>` +
    `<path d="M-5 -7 L-2.4 -3.2 L0 -8 L2.4 -3.2 L5 -7 L5 -1 C5 3.5 -5 3.5 -5 -1 Z" fill="${c}"/>`,
  sprout: (c: string) =>
    `<path d="M0 7 L0 -1" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>` +
    `<path d="M0 -1 C-1 -6 -6 -6.5 -7.5 -4.5 C-5.5 -1.2 -2 -0.8 0 -1 Z" fill="${c}"/>` +
    `<path d="M0 1 C1 -4 6 -4.5 7.5 -2.5 C5.5 0.8 2 1.2 0 1 Z" fill="${c}"/>`,
  ray: (c: string) => `<path d="M0 -3.2 L0 3.2" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>`,
  snowflake: (c: string) =>
    radial(6, (a) => rot(a, `<path d="M0 0 L0 -8.5 M0 -5 L-2.4 -7.2 M0 -5 L2.4 -7.2" stroke="${c}" stroke-width="1.3" stroke-linecap="round" fill="none"/>`)),
  star: (c: string) => `<path d="${starPath(9, 4)}" fill="${c}" stroke="${c}" stroke-width="0.8" stroke-linejoin="round"/>`,
  sparkle: (c: string) => `<path d="M0 -9 C1 -2 2 -1 9 0 C2 1 1 2 0 9 C-1 2 -2 1 -9 0 C-2 -1 -1 -2 0 -9 Z" fill="${c}"/>`,
  dot: (c: string) => `<circle r="3" fill="${c}"/>`,
  egg: (c: string, c2 = '#FFFFFF') =>
    `<path d="M0 -9 C5 -9 7 -1 7 3 C7 7.5 4 10 0 10 C-4 10 -7 7.5 -7 3 C-7 -1 -5 -9 0 -9 Z" fill="${c}"/>` +
    `<path d="M-6.8 1.4 L-4.1 -1 L-1.4 1.4 L1.4 -1 L4.1 1.4 L6.8 -1" fill="none" stroke="${c2}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<circle cx="-2.6" cy="5.6" r="1" fill="${c2}"/><circle cx="2.6" cy="5.6" r="1" fill="${c2}"/><circle cx="0" cy="-4.5" r="1" fill="${c2}"/>`,
  grass: (c: string) =>
    `<path d="M-5 5 Q-5 -1 -8 -5 M-1.5 5 Q-1.5 -3 -0.5 -8 M2 5 Q2 -1 5 -5.5 M5 5 Q6 0 9 -2" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>`,
  chick: (c: string, c2 = '#EE7A2F') =>
    `<circle r="9" fill="${c}"/>` +
    `<path d="M-6 1 C-4 5 1 5 2 1 C-1 2.5 -3.5 2.5 -6 1 Z" fill="#E0A100"/>` +
    `<circle cx="3" cy="-2.4" r="1.3" fill="#2B1840"/>` +
    `<path d="M7.6 -1.6 L12 0 L7.6 1.8 Z" fill="${c2}"/>` +
    `<path d="M-1 -9 C-1 -12 1 -12 1.5 -9.5" fill="none" stroke="#E0A100" stroke-width="1.2" stroke-linecap="round"/>`,
  pumpkin: (c: string, c2 = '#2B1840') =>
    `<rect x="-1.3" y="-11" width="2.6" height="4" rx="1" fill="#4E8B3A"/>` +
    `<ellipse cx="-4.2" cy="0" rx="5.4" ry="8" fill="${c}" stroke="#C25E14" stroke-width="0.7"/>` +
    `<ellipse cx="4.2" cy="0" rx="5.4" ry="8" fill="${c}" stroke="#C25E14" stroke-width="0.7"/>` +
    `<ellipse cx="0" cy="0" rx="5.6" ry="8.4" fill="${c}" stroke="#C25E14" stroke-width="0.7"/>` +
    `<path d="M-5.2 -2.2 L-2.2 -2.2 L-3.7 -5 Z M5.2 -2.2 L2.2 -2.2 L3.7 -5 Z" fill="${c2}"/>` +
    `<path d="M-5.5 1.8 L-3.6 3.2 L-1.8 1.9 L0 3.4 L1.8 1.9 L3.6 3.2 L5.5 1.8 L4 5 L-4 5 Z" fill="${c2}"/>`,
  bat: (c: string) =>
    `<path d="M0 -2 C1 -4.5 2 -4.6 2.4 -2.4 C4.5 -4.6 7.5 -4.4 10.5 -1 C8 -1.2 6.8 0.5 6.3 2.2 C5.2 0.6 3.8 0.4 2.7 1.8 C1.9 1.2 1 2.1 0 3.6 C-1 2.1 -1.9 1.2 -2.7 1.8 C-3.8 0.4 -5.2 0.6 -6.3 2.2 C-6.8 0.5 -8 -1.2 -10.5 -1 C-7.5 -4.4 -4.5 -4.6 -2.4 -2.4 C-2 -4.6 -1 -4.5 0 -2 Z" fill="${c}"/>`,
  /** Fine sparks with bright tips, alternating long and short. */
  firework: (c: string, c2 = '#FFFFFF') =>
    radial(16, (a) => {
      const long = Math.round(a / 22.5) % 2 === 0;
      return rot(
        a,
        `<path d="M0 -3 L0 ${long ? -9.5 : -6.5}" stroke="${c}" stroke-width="${long ? 0.95 : 0.75}" stroke-linecap="round"/>` +
          `<circle cx="0" cy="${long ? -11.4 : -8.2}" r="${long ? 0.85 : 0.6}" fill="${long ? c2 : c}"/>`,
      );
    }) +
    `<path d="M0 -2.6 C0.3 -0.6 0.6 -0.3 2.6 0 C0.6 0.3 0.3 0.6 0 2.6 C-0.3 0.6 -0.6 0.3 -2.6 0 C-0.6 -0.3 -0.3 -0.6 0 -2.6 Z" fill="${c2}"/>`,
  twinkle: (c: string) =>
    `<path d="M0 -9 C0.6 -1.6 1.6 -0.6 9 0 C1.6 0.6 0.6 1.6 0 9 C-0.6 1.6 -1.6 0.6 -9 0 C-1.6 -0.6 -0.6 -1.6 0 -9 Z" fill="${c}"/>` +
    `<path d="M0 -4 L0 4 M-4 0 L4 0" stroke="${c}" stroke-width="0.6" opacity="0.6" transform="rotate(45)"/>`,
  lantern: (c: string, c2 = '#E8B53A') =>
    `<path d="M0 -24 L0 -7" stroke="${c2}" stroke-width="0.8"/>` +
    `<rect x="-3.4" y="-8" width="6.8" height="2.4" rx="0.8" fill="${c2}"/>` +
    `<ellipse cx="0" cy="0" rx="7.4" ry="6.6" fill="${c}"/>` +
    `<ellipse cx="0" cy="0" rx="3.6" ry="6.6" fill="none" stroke="#8E0B1F" stroke-width="0.7"/>` +
    `<rect x="-2.8" y="5.6" width="5.6" height="2.2" rx="0.8" fill="${c2}"/>` +
    `<path d="M0 7.8 L0 13 M-1 8 L-1.4 12 M1 8 L1.4 12" stroke="${c2}" stroke-width="0.9" stroke-linecap="round"/>`,
  /** A fluffy lucky cloud: puffs all round, the bottom too, with curls cut in. */
  cloud: (c: string, c2 = '#FFF4E6') =>
    [[-8.6, 1.6, 2.8], [-5, -1, 3.6], [0, -3, 4.6], [5.2, -1.2, 3.8], [9, 1.4, 2.8], [5.6, 3.4, 3], [1, 3.8, 3.4], [-4, 3.6, 3.1]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`)
      .join('') +
    `<path d="M-1.6 0.4 C-1.6 -2.4 2.4 -2.4 2.4 0 C2.4 1.8 -0.2 2 -0.2 0.4" fill="none" stroke="${c2}" stroke-width="0.9" stroke-linecap="round"/>` +
    `<path d="M-6.6 1.8 C-6.6 -0.4 -3.6 -0.4 -3.6 1.4" fill="none" stroke="${c2}" stroke-width="0.8" stroke-linecap="round"/>` +
    `<path d="M4.6 1.6 C4.6 -0.6 7.6 -0.6 7.6 1.2" fill="none" stroke="${c2}" stroke-width="0.8" stroke-linecap="round"/>`,
  coin: (c: string, c2 = '#C8102E') =>
    `<circle r="6.4" fill="${c}"/><circle r="5" fill="none" stroke="${c2}" stroke-width="0.6" opacity="0.5"/><rect x="-1.7" y="-1.7" width="3.4" height="3.4" fill="${c2}"/>`,
} satisfies Record<string, (c: string, c2?: string) => string>;

export type ShapeName = keyof typeof SHAPES;

export function shape(name: ShapeName, c: string, c2?: string): string {
  return (SHAPES[name] as (c: string, c2?: string) => string)(c, c2);
}

// ---------------------------------------------------------------------------------------------
// Designs

/**
 * A motif around the ring: at angle `a` (degrees clockwise from three o'clock) and radius `r` (30
 * unless given) from the centre, or at `x`, `y` in the grid. `turn` rotates it, `'radial'` points it
 * outwards. `appC` replaces `c` inside the app, where a white spark would vanish on the pale page.
 */
export interface Motif {
  s: ShapeName;
  a?: number;
  r?: number;
  x?: number;
  y?: number;
  size: number;
  turn?: number | 'radial';
  c: string;
  c2?: string;
  appC?: string;
}

export interface Design {
  key: DesignKey;
  /** The name Paul chose it under, for scripts and docs. */
  name: string;
  /** Ground of the icon. */
  bg: string;
  ring: string;
  spiral: string;
  sun: string;
  /** The sun grows by this factor, or becomes `sunShape` (scaled to the sun's radius). */
  sunScale?: number;
  sunShape?: ShapeName;
  motifs: readonly Motif[];
  /**
   * The look inside the app: `glow` for the top of every screen, `mark` and `sun` replace ring and
   * sun colour of the backdrop, `motif` paints every motif in one colour, `scatter` strews this
   * shape (in the sun's colour) over the top instead of the motifs.
   */
  app: { glow: string; mark?: string; sun?: string; motif?: string; scatter?: ShapeName };
}

/** Twelve evenly spaced positions, like the hour dots. */
const ring12 = (offset: number, fn: (deg: number) => Motif) => Array.from({ length: 12 }, (_, i) => fn(offset + i * 30));

export const DESIGNS: Record<DesignKey, Design> = {
  fruehling: {
    key: 'fruehling',
    name: 'Tulpenbeet',
    bg: '#EEF6E6',
    ring: '#3F7D2B',
    spiral: '#1A5FC2',
    sun: '#F2A43A',
    motifs: [
      { s: 'tulip', a: 40, size: 0.6, turn: -18, c: '#D9453B' },
      { s: 'tulip', a: 75, size: 0.62, turn: -6, c: '#F2B632' },
      { s: 'tulip', a: 108, size: 0.6, turn: 6, c: '#8E5BC9' },
      { s: 'tulip', a: 142, size: 0.58, turn: 18, c: '#D9453B' },
      { s: 'sprout', a: -60, size: 0.5, turn: 30, c: '#4E8B3A' },
      { s: 'sprout', a: -125, size: 0.46, turn: -35, c: '#6BA84F' },
      { s: 'sprout', a: -5, size: 0.42, turn: 80, c: '#6BA84F' },
      { s: 'sprout', a: 185, size: 0.42, turn: -80, c: '#4E8B3A' },
    ],
    app: { glow: '#E2F3D4' },
  },
  sommer: {
    key: 'sommer',
    name: 'Hochsommer',
    bg: '#FFF3C9',
    ring: '#D9700F',
    spiral: '#11786A',
    sun: '#F2A43A',
    sunScale: 1.7,
    motifs: ring12(15, (a) => ({ s: 'ray', a, r: 29.5, size: 0.75, turn: 'radial', c: '#F2A43A' })),
    app: { glow: '#FFEDB8' },
  },
  herbst: {
    key: 'herbst',
    name: 'Laubregen',
    bg: '#F6EBDD',
    ring: '#A4471F',
    spiral: '#11786A',
    sun: '#EE7A2F',
    motifs: [
      { s: 'maple', a: -60, size: 0.5, turn: 25, c: '#C8502A' },
      { s: 'oval', a: 0, size: 0.6, turn: 60, c: '#E8A33A' },
      { s: 'oval', a: 60, size: 0.55, turn: 20, c: '#EE7A2F' },
      { s: 'maple', a: 125, size: 0.48, turn: 35, c: '#E8A33A' },
      { s: 'oval', a: 180, size: 0.6, turn: -40, c: '#A4471F' },
      { s: 'maple', a: -150, size: 0.45, turn: -20, c: '#EE7A2F' },
    ],
    app: { glow: '#FBE6D2' },
  },
  winter: {
    key: 'winter',
    name: 'Winternacht',
    bg: '#0B2250',
    ring: '#EAF3FC',
    spiral: '#9CC7F0',
    sun: '#FFD27A',
    motifs: [
      { s: 'snowflake', a: -60, size: 0.6, turn: 0, c: '#FFFFFF' },
      { s: 'sparkle', a: 0, size: 0.4, turn: 0, c: '#FFD27A' },
      { s: 'snowflake', a: 60, size: 0.5, turn: 12, c: '#BFD8F5' },
      { s: 'snowflake', a: 125, size: 0.56, turn: 20, c: '#FFFFFF' },
      { s: 'sparkle', a: 180, size: 0.42, turn: 0, c: '#FFD27A' },
      { s: 'snowflake', a: -140, size: 0.48, turn: 8, c: '#BFD8F5' },
    ],
    app: { glow: '#E2E4F8', mark: '#0B2250', motif: '#1A5FC2' },
  },
  ostern: {
    key: 'ostern',
    name: 'Küken',
    bg: '#FFF6D6',
    ring: '#D99100',
    spiral: '#11786A',
    sun: '#F7C933',
    sunShape: 'chick',
    sunScale: 1.7,
    motifs: [
      { s: 'grass', a: 55, size: 0.6, turn: -15, c: '#4E8B3A' },
      { s: 'grass', a: 90, r: 31, size: 0.62, turn: 0, c: '#6BA84F' },
      { s: 'grass', a: 125, size: 0.6, turn: 15, c: '#4E8B3A' },
      { s: 'blossom', a: -20, size: 0.4, turn: 0, c: '#FFFFFF', c2: '#F2B632' },
      { s: 'blossom', a: -150, size: 0.38, turn: 20, c: '#FFFFFF', c2: '#F2B632' },
      { s: 'egg', a: 190, size: 0.42, turn: 25, c: '#F2A88A' },
    ],
    app: { glow: '#FFF0BD' },
  },
  halloween: {
    key: 'halloween',
    name: 'Kürbislaterne',
    bg: '#2B1840',
    ring: '#F28C28',
    spiral: '#F7B955',
    sun: '#F28C28',
    sunShape: 'pumpkin',
    sunScale: 1.9,
    motifs: [
      { s: 'sparkle', a: -40, size: 0.35, c: '#F7B955' },
      { s: 'sparkle', a: 60, size: 0.3, c: '#F7B955' },
      { s: 'sparkle', a: 160, size: 0.32, c: '#F7B955' },
      { s: 'bat', a: -110, size: 0.42, turn: -10, c: '#8E6BC9' },
    ],
    app: { glow: '#FFE4CC', mark: '#F28C28', scatter: 'pumpkin' },
  },
  weihnachten: {
    key: 'weihnachten',
    name: 'Rot und Gold',
    bg: '#9B1C2C',
    ring: '#F5D27A',
    spiral: '#F5D27A',
    sun: '#FFF1C9',
    motifs: [
      { s: 'star', a: -60, size: 0.5, turn: 10, c: '#F5D27A' },
      { s: 'sparkle', a: 0, size: 0.38, c: '#FFF1C9' },
      { s: 'star', a: 60, size: 0.42, turn: -12, c: '#F5D27A' },
      { s: 'sparkle', a: 120, size: 0.36, c: '#FFF1C9' },
      { s: 'star', a: 180, size: 0.46, turn: 18, c: '#F5D27A' },
      { s: 'sparkle', a: -125, size: 0.4, c: '#FFF1C9' },
    ],
    app: { glow: '#FFE2E2', mark: '#9B1C2C', sun: '#E8B53A', motif: '#C99A2E' },
  },
  silvester: {
    key: 'silvester',
    name: 'Feuerwerk',
    bg: '#0B2250',
    ring: '#FBF7F0',
    spiral: '#9CC7F0',
    sun: '#FFD27A',
    motifs: [
      { s: 'firework', a: -62, size: 0.66, c: '#FFD27A', c2: '#FFFFFF' },
      { s: 'firework', a: 12, size: 0.48, c: '#FF7FA8', c2: '#FFD27A' },
      { s: 'firework', a: 92, size: 0.56, c: '#7FE0D0', c2: '#FFFFFF' },
      { s: 'firework', a: 165, size: 0.52, c: '#B794E6', c2: '#FFD27A' },
      { s: 'firework', a: -140, size: 0.46, c: '#FF7FA8', c2: '#FFFFFF' },
      { s: 'twinkle', a: -100, r: 32, size: 0.3, c: '#FFFFFF', appC: '#E8B53A' },
      { s: 'twinkle', a: -22, r: 31, size: 0.22, c: '#FFD27A' },
      { s: 'twinkle', a: 50, r: 32, size: 0.28, c: '#FFFFFF', appC: '#E8B53A' },
      { s: 'twinkle', a: 128, r: 31, size: 0.22, c: '#FFD27A' },
      { s: 'twinkle', a: 205, r: 31, size: 0.26, c: '#FFFFFF', appC: '#E8B53A' },
      { s: 'dot', a: -178, r: 33, size: 0.2, c: '#FFD27A' },
      { s: 'dot', a: 70, r: 26.5, size: 0.18, c: '#FFFFFF', appC: '#E8B53A' },
      { s: 'dot', a: -40, r: 26.5, size: 0.18, c: '#FFFFFF', appC: '#E8B53A' },
    ],
    app: { glow: '#E4E7FA', mark: '#0B2250' },
  },
  neujahrsfest: {
    key: 'neujahrsfest',
    name: 'Laternen',
    bg: '#FFF4E6',
    ring: '#C8102E',
    spiral: '#D4A017',
    sun: '#F2A43A',
    motifs: [
      { s: 'lantern', a: -125, r: 28.5, size: 0.62, turn: 0, c: '#D7262E' },
      { s: 'lantern', a: -55, r: 28.5, size: 0.62, turn: 0, c: '#D7262E' },
      { s: 'lantern', a: -90, r: 32, size: 0.42, turn: 0, c: '#E8503A' },
      { s: 'coin', a: 60, size: 0.42, c: '#E8B53A', c2: '#FFF4E6' },
      { s: 'coin', a: 120, size: 0.42, c: '#E8B53A', c2: '#FFF4E6' },
      { s: 'cloud', a: 178, r: 30.5, size: 0.48, c: '#E8B53A', c2: '#FFF4E6' },
      { s: 'cloud', a: 2, r: 30.5, size: 0.48, c: '#E8B53A', c2: '#FFF4E6' },
    ],
    app: { glow: '#FFE2DD' },
  },
};

// ---------------------------------------------------------------------------------------------
// Composition in the 108 grid, as SVG markup without the outer <svg>

const f = (n: number) => n.toFixed(2);
const at = (a: number, r: number) => [CENTER + r * Math.cos((a * Math.PI) / 180), CENTER + r * Math.sin((a * Math.PI) / 180)] as const;

export function motifMarkup(m: Motif): string {
  const [x, y] = m.x !== undefined && m.y !== undefined ? [m.x, m.y] : at(m.a ?? 0, m.r ?? 30);
  const turn = m.turn === 'radial' ? (m.a ?? 0) + 90 : (m.turn ?? 0);
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${turn}) scale(${m.size})">${shape(m.s, m.c, m.c2)}</g>`;
}

/** Ring, hour dots, spiral and the sun (or the shape that replaces it) in the given colours. */
export function markMarkup(logo: LogoGeometry, design: Design, colors: { ring: string; spiral: string; sun: string }): string {
  const hours = logo.hours.map((h) => `<circle cx="${h.cx}" cy="${h.cy}" r="${f(h.r)}" fill="${colors.ring}" opacity="${h.opacity}"/>`).join('');
  const sunR = logo.sun.r * (design.sunScale ?? 1);
  const sun = design.sunShape
    ? `<g transform="translate(${logo.sun.cx} ${logo.sun.cy}) scale(${f(sunR / 9)})">${shape(design.sunShape, colors.sun)}</g>`
    : `<circle cx="${logo.sun.cx}" cy="${logo.sun.cy}" r="${f(sunR)}" fill="${colors.sun}"/>`;
  return (
    `<path d="${logo.ring.d}" fill="none" stroke="${colors.ring}" stroke-width="${logo.ring.width}" stroke-linejoin="round"/>` +
    hours +
    `<path d="${logo.spiral.d}" fill="none" stroke="${colors.spiral}" stroke-width="${logo.spiral.width}" stroke-linecap="round" stroke-linejoin="round"/>` +
    sun
  );
}

/** Wraps the mark so it shrinks around the centre to `MARK_SCALE`. */
export function shrunk(markup: string): string {
  return `<g transform="translate(${CENTER} ${CENTER}) scale(${MARK_SCALE}) translate(${-CENTER} ${-CENTER})">${markup}</g>`;
}

/**
 * The icon: motifs round the shrunk mark, on the design's ground unless `ground` is false (the
 * foreground layer of the adaptive icon). The motifs stay inside the visible circle of radius 36.
 */
export function compose(design: Design, logo: LogoGeometry, { ground = true } = {}): string {
  return (
    (ground ? `<rect width="108" height="108" fill="${design.bg}"/>` : '') +
    design.motifs.map(motifMarkup).join('') +
    shrunk(markMarkup(logo, design, design))
  );
}
