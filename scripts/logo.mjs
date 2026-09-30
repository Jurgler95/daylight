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
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
 * `weight` thickens the strokes for tiny sizes.
 */
function mark(mono, weight = 1) {
  const color = mono ?? logo.mark;
  const hours = logo.hours
    .map((h) => `<circle cx="${h.cx}" cy="${h.cy}" r="${h.r}" fill="${color}" opacity="${h.opacity}"/>`)
    .join('');
  return [
    `<path d="${logo.ring.d}" fill="none" stroke="${color}" stroke-width="${logo.ring.width * weight}" stroke-linejoin="round"/>`,
    hours,
    `<path d="${logo.spiral.d}" fill="none" stroke="${color}" stroke-width="${logo.spiral.width * weight}" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<circle cx="${logo.sun.cx}" cy="${logo.sun.cy}" r="${logo.sun.r}" fill="${mono ?? logo.sun.color}"/>`,
  ].join('');
}

function document(viewBox, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
}

const ground = `<rect x="0" y="0" width="108" height="108" fill="${logo.background}"/>`;

const VARIANTS = [
  // Legacy and iOS icon: fills the whole square, cropped a little tighter than the adaptive grid so
  // the ring does not look lost without a launcher mask.
  { file: 'icon.png', size: 1024, svg: document('12 12 84 84', ground + mark()) },
  // Adaptive icon layers: full 108 grid, the launcher crops and masks them itself.
  { file: 'android-icon-foreground.png', size: 512, svg: document('0 0 108 108', mark()) },
  { file: 'android-icon-background.png', size: 512, svg: document('0 0 108 108', ground) },
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
  // Notification icon (expo-notifications): all white on transparent, 96 px, the ring filling the
  // 20 of 24 dp that Android's guidelines allow, strokes a little heavier for the status bar.
  { file: 'notification-icon.png', size: 96, svg: document('16 16 76 76', mark('#FFFFFF', 1.5)) },
];

function rasterize() {
  const dir = mkdtempSync(join(tmpdir(), 'daylight-logo-'));
  try {
    for (const variant of VARIANTS) {
      const input = join(dir, variant.file.replace(/\.png$/, '.svg'));
      writeFileSync(input, variant.svg);
      execFileSync('npx', ['-y', RESVG, '--fit-width', String(variant.size), input, join(ROOT, 'assets', variant.file)], {
        stdio: ['ignore', 'ignore', 'inherit'],
      });
      console.log(`assets/${variant.file} (${variant.size} px)`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

writePaths();
if (!process.argv.includes('--paths-only')) rasterize();
