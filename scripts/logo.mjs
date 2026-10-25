#!/usr/bin/env node
/**
 * Erzeugt alle Icon-Varianten, den Splash, das Favicon und die Logo-Geometrie für die App aus
 * `assets/logo.svg`, der einzigen Quelle des Logos.
 *
 *   node scripts/logo.mjs               alles neu erzeugen
 *   node scripts/logo.mjs --paths-only  nur components/ui/logoPaths.ts (ohne Rastern)
 *
 * Gerastert wird mit `npx @resvg/resvg-js-cli`, das npx bei Bedarf in seinen Cache lädt. Es ist
 * bewusst keine Abhängigkeit des Projekts.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'assets/logo.svg');
const PATHS_FILE = join(ROOT, 'components/ui/logoPaths.ts');
const RESVG = '@resvg/resvg-js-cli@2.6.2-beta.1';

/** Center of the 108 × 108 adaptive icon grid. */
const CENTER = 54;
/** Launchers mask the visible 72 × 72 of the grid, round ones as a circle of this radius. */
const VISIBLE_RADIUS = 36;

// ---------------------------------------------------------------------------------------------
// Parse the source

const svg = readFileSync(SOURCE, 'utf8');

function tag(selector) {
  const match = svg.match(new RegExp(`<[a-z]+ ${selector}[^>]*/>`));
  if (!match) throw new Error(`logo.svg: ${selector} fehlt`);
  return match[0];
}

function attr(element, name) {
  const match = element.match(new RegExp(` ${name}="([^"]*)"`));
  if (!match) throw new Error(`logo.svg: Attribut ${name} fehlt in ${element.slice(0, 40)}`);
  return match[1];
}

const background = attr(tag('id="background"'), 'fill');
const ringTag = tag('id="ring"');
const spiralTag = tag('id="spiral"');
const sunTag = tag('id="sun"');
const hourTags = svg.match(/<circle class="hour"[^>]*\/>/g) ?? [];
if (hourTags.length !== 12) throw new Error(`logo.svg: 12 Stundenpunkte erwartet, ${hourTags.length} gefunden`);

const logo = {
  background,
  mark: attr(ringTag, 'stroke'),
  ring: { d: attr(ringTag, 'd'), width: Number(attr(ringTag, 'stroke-width')) },
  hours: hourTags.map((h) => ({
    cx: Number(attr(h, 'cx')),
    cy: Number(attr(h, 'cy')),
    r: Number(attr(h, 'r')),
    opacity: Number(attr(h, 'opacity')),
  })),
  spiral: { d: attr(spiralTag, 'd'), width: Number(attr(spiralTag, 'stroke-width')) },
  sun: { cx: Number(attr(sunTag, 'cx')), cy: Number(attr(sunTag, 'cy')), r: Number(attr(sunTag, 'r')), color: attr(sunTag, 'fill') },
};

// ---------------------------------------------------------------------------------------------
// Geometry for the app (logo mark and backdrop)

function writePaths() {
  const hours = logo.hours.map((h) => `  { cx: ${h.cx}, cy: ${h.cy}, r: ${h.r}, opacity: ${h.opacity} },`).join('\n');
  const source = `/**
 * Generated from assets/logo.svg by \`node scripts/logo.mjs\`; do not edit by hand.
 * Coordinates live in the 108 × 108 grid of an Android adaptive icon, centred on (${CENTER}, ${CENTER}).
 */
export const LOGO_GRID = 108;
export const LOGO_CENTER = ${CENTER};

/** Colours of the logo itself: petrol ground, cream mark, amber sun. */
export const LOGO_COLORS = { background: '${logo.background}', mark: '${logo.mark}', sun: '${logo.sun.color}' } as const;

/** The wavy ring with twelve waves, drawn as a stroke. */
export const RING = { d: '${logo.ring.d}', width: ${logo.ring.width} } as const;

/** The twelve hour dots, clockwise from twelve; the four main hours are larger and opaque. */
export const HOURS: readonly { cx: number; cy: number; r: number; opacity: number }[] = [
${hours}
];

/** The Archimedean spiral, drawn as a round-capped stroke from the centre outwards. */
export const SPIRAL = { d: '${logo.spiral.d}', width: ${logo.spiral.width} } as const;

/** The sun at the end of the spiral, pointing at 20:30. */
export const SUN = { cx: ${logo.sun.cx}, cy: ${logo.sun.cy}, r: ${logo.sun.r} } as const;
`;
  writeFileSync(PATHS_FILE, source);
  console.log('components/ui/logoPaths.ts');
}

// ---------------------------------------------------------------------------------------------
// Icon variants

/**
 * Ring, hour dots, spiral and sun. `mono` paints everything in one colour for themed icons,
 * `weight` thickens the strokes for tiny sizes, `colors` overrides ring and dots, spiral and sun.
 */
function mark(mono, weight = 1, colors = {}) {
  const ring = mono ?? colors.ring ?? logo.mark;
  const spiral = mono ?? colors.spiral ?? logo.mark;
  const hours = logo.hours
    .map((h) => `<circle cx="${h.cx}" cy="${h.cy}" r="${h.r}" fill="${ring}" opacity="${h.opacity}"/>`)
    .join('');
  return [
    `<path d="${logo.ring.d}" fill="none" stroke="${ring}" stroke-width="${logo.ring.width * weight}" stroke-linejoin="round"/>`,
    hours,
    `<path d="${logo.spiral.d}" fill="none" stroke="${spiral}" stroke-width="${logo.spiral.width * weight}" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<circle cx="${logo.sun.cx}" cy="${logo.sun.cy}" r="${logo.sun.r}" fill="${mono ?? colors.sun ?? logo.sun.color}"/>`,
  ].join('');
}

// ---------------------------------------------------------------------------------------------
// Seasonal launcher icon

const MAPLE =
  'M0 -10 L1.8 -5.5 L4.6 -6.8 L3.8 -2.4 L8.6 -3.6 L6.8 -0.6 L9 1.2 L4.2 2.4 L4.8 5.6 L1 3.8 L0.6 9 L-0.6 9 L-1 3.8 L-4.8 5.6 L-4.2 2.4 L-9 1.2 L-6.8 -0.6 L-8.6 -3.6 L-3.8 -2.4 L-4.6 -6.8 L-1.8 -5.5 Z';
const OVAL = 'M0 -6 C3.4 -3 3.4 3 0 6 C-3.4 3 -3.4 -3 0 -6 Z';

/**
 * Seasons for the launcher icon, in the colours of the matching store icon (`store/icon-*.svg`).
 * Leaves sit at `angle` (degrees, clockwise from three o'clock) on a circle around the centre, in
 * the gap between the shrunk mark and the edge of the round launcher mask, so none is cut off.
 */
const SEASONS = {
  herbst: {
    background: '#F6EBDD',
    colors: { ring: '#A4471F', spiral: '#11786A', sun: '#EE7A2F' },
    /** The mark shrinks to this share, so the leaves fit inside the visible circle. */
    scale: 0.78,
    radius: 30,
    leaves: [
      { angle: -60, shape: MAPLE, size: 0.5, turn: 25, color: '#C8502A' },
      { angle: 0, shape: OVAL, size: 0.6, turn: 60, color: '#E8A33A' },
      { angle: 60, shape: OVAL, size: 0.55, turn: 20, color: '#EE7A2F' },
      { angle: 125, shape: MAPLE, size: 0.48, turn: 35, color: '#E8A33A' },
      { angle: 180, shape: OVAL, size: 0.6, turn: -40, color: '#A4471F' },
      { angle: -150, shape: MAPLE, size: 0.45, turn: -20, color: '#EE7A2F' },
    ],
  },
};

/**
 * The season the launcher icon wears, from the switch it shares with the store icon in
 * `store/season.js`: a key of `SEASONS`, or null for the logo. Only the launcher icon (legacy icon
 * and the foreground and background layers) follows it; splash, favicon, notification and themed
 * icon and the logo inside the app stay as they are.
 */
function readSeason() {
  const context = { window: {} };
  runInNewContext(readFileSync(join(ROOT, 'store/season.js'), 'utf8'), context);
  const name = context.window.SEASON ?? null;
  if (name !== null && !SEASONS[name]) throw new Error(`store/season.js: Jahreszeit '${name}' fehlt in SEASONS`);
  return name;
}

const SEASON = readSeason();
const season = SEASON ? SEASONS[SEASON] : null;

function seasonForeground() {
  const leaves = season.leaves
    .map(({ angle, shape, size, turn, color }) => {
      const x = (CENTER + season.radius * Math.cos((angle * Math.PI) / 180)).toFixed(2);
      const y = (CENTER + season.radius * Math.sin((angle * Math.PI) / 180)).toFixed(2);
      const outline = shape === MAPLE ? ` stroke="${color}" stroke-width="1.2" stroke-linejoin="round"` : '';
      return `<path transform="translate(${x} ${y}) rotate(${turn}) scale(${size})" d="${shape}" fill="${color}"${outline}/>`;
    })
    .join('');
  const shrink = `translate(${CENTER} ${CENTER}) scale(${season.scale}) translate(${-CENTER} ${-CENTER})`;
  return `${leaves}<g transform="${shrink}">${mark(undefined, 1, season.colors)}</g>`;
}

function document(viewBox, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
}

const ground = `<rect x="0" y="0" width="108" height="108" fill="${logo.background}"/>`;
/** Ground and mark of the launcher icon, in the season's look while one is set. */
const iconGround = season ? `<rect x="0" y="0" width="108" height="108" fill="${season.background}"/>` : ground;
const iconMark = season ? seasonForeground() : mark();

const VARIANTS = [
  // Legacy and iOS icon: fills the whole square, cropped a little tighter than the adaptive grid so
  // the ring does not look lost without a launcher mask.
  { file: 'icon.png', size: 1024, svg: document('12 12 84 84', iconGround + iconMark) },
  // Adaptive icon layers: full 108 grid, the launcher crops and masks them itself.
  { file: 'android-icon-foreground.png', size: 512, svg: document('0 0 108 108', iconMark) },
  { file: 'android-icon-background.png', size: 512, svg: document('0 0 108 108', iconGround) },
  { file: 'android-icon-monochrome.png', size: 432, svg: document('0 0 108 108', mark('#FFFFFF')) },
  // Splash (Android 12+ shows it as the window icon and masks it to a circle of two thirds): the
  // round launcher icon, on a transparent square with exactly that margin.
  {
    file: 'splash-icon.png',
    size: 1024,
    svg: document('0 0 108 108', `<circle cx="${CENTER}" cy="${CENTER}" r="${VISIBLE_RADIUS}" fill="${logo.background}"/>` + mark()),
  },
  // Favicon: only the visible part, so the ring stays legible at 48 px.
  { file: 'favicon.png', size: 48, svg: document('18 18 72 72', ground + mark()) },
  // Notification icon (modules/daylight-reminders): all white on transparent, 24 dp per density,
  // the ring filling the 20 of 24 dp that Android's guidelines allow, strokes a little heavier for
  // the status bar.
  ...Object.entries({ mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 }).map(([density, size]) => ({
    file: `modules/daylight-reminders/android/src/main/res/drawable-${density}/daylight_reminder_icon.png`,
    size,
    svg: document('16 16 76 76', mark('#FFFFFF', 1.5)),
  })),
];

function rasterize() {
  const dir = mkdtempSync(join(tmpdir(), 'daylight-logo-'));
  try {
    for (const variant of VARIANTS) {
      // Plain names go to assets/, the notification icons carry their own path.
      const target = variant.file.includes('/') ? variant.file : `assets/${variant.file}`;
      const input = join(dir, `${variant.size}-${basename(variant.file).replace(/\.png$/, '.svg')}`);
      writeFileSync(input, variant.svg);
      execFileSync('npx', ['-y', RESVG, '--fit-width', String(variant.size), input, join(ROOT, target)], {
        stdio: ['ignore', 'ignore', 'inherit'],
      });
      console.log(`${target} (${variant.size} px)`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

writePaths();
if (!process.argv.includes('--paths-only')) rasterize();
