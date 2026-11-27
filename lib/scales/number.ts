/**
 * A number scale holds any measured value, like a weight in kg or glasses of water: typed in, with
 * a unit and up to two decimals, and without a fixed range.
 */
export const NUMBER_MAX_DECIMALS = 2;
/** Values stay below a million either way, so a typo like 7240 for 72,40 still fits but nothing absurd. */
export const NUMBER_LIMIT = 1_000_000;
export const UNIT_MAX_LENGTH = 12;

/** Rounds half away from zero to the scale's decimals, without binary noise (72.35 stays 72.35). */
export function roundToDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const scaled = Number((Math.abs(value) * factor).toPrecision(12));
  const rounded = (Math.sign(value) * Math.round(scaled)) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function clampDecimals(decimals: number): number {
  return Math.min(NUMBER_MAX_DECIMALS, Math.max(0, Math.round(decimals)));
}

/**
 * What was typed: "72,4", "72.4", "-3" or " 1 200,5 ". Comma and dot both mean the decimal point,
 * spaces are ignored. Empty is null (no value); anything unreadable or out of range is `invalid`.
 * More decimals than the scale has are `tooPrecise` rather than rounded: "1.500" on a whole-number
 * scale is a thousands separator, and silently saving 2 would be wrong.
 */
export function parseNumberInput(text: string, decimals: number): number | null | 'invalid' | 'tooPrecise' {
  const clean = text.replace(/\s/g, '').replace(',', '.');
  if (clean === '') return null;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(clean)) return 'invalid';
  const point = clean.indexOf('.');
  if (point >= 0 && clean.length - point - 1 > clampDecimals(decimals)) return 'tooPrecise';
  const value = Number(clean);
  return Number.isFinite(value) && Math.abs(value) < NUMBER_LIMIT ? (Object.is(value, -0) ? 0 : value) : 'invalid';
}

/** A unit as stored: trimmed, inner spaces collapsed, cut to `UNIT_MAX_LENGTH`. */
export function cleanUnit(unit: string): string {
  return unit.trim().replace(/\s+/g, ' ').slice(0, UNIT_MAX_LENGTH).trim();
}
