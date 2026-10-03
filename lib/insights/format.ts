import { currentLanguage } from '@/lib/i18n/language';

/**
 * Rounds half away from zero on the decimal value, not on its binary approximation: `toFixed` turns
 * 4.35 into "4.3" and 1.005 into "1.00". Twelve significant digits drop the binary noise first.
 * Negative zero comes back as zero, NaN stays NaN so the render tests still catch it.
 */
function roundDecimal(value: number, digits: number): number {
  const factor = 10 ** digits;
  const scaled = Number((Math.abs(value) * factor).toPrecision(12));
  const rounded = (Math.sign(value) * Math.round(scaled)) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** "4,3" in German, "4.3" in English, fixed digits. */
export function formatDecimal(value: number, digits = 1): string {
  const text = roundDecimal(value, digits).toFixed(digits);
  return currentLanguage() === 'en' ? text : text.replace('.', ',');
}

/** "+0,4" or "-0,2"; zero without a sign. */
export function formatSigned(value: number, digits = 1): string {
  if (roundDecimal(Math.abs(value), digits) === 0) return formatDecimal(0, digits);
  const text = formatDecimal(Math.abs(value), digits);
  return `${value > 0 ? '+' : '-'}${text}`;
}

/** "74 %" in German, "74%" in English, for a share 0..1, whole percent. */
export function formatPercent(share: number): string {
  return `${roundDecimal(share * 100, 0)}${currentLanguage() === 'en' ? '' : ' '}%`;
}

/** "1,8" for a ratio, one decimal. */
export function formatRatio(ratio: number): string {
  return formatDecimal(ratio, 1);
}

/** "10.000" in German, "10,000" in English, whole numbers. */
export function formatCount(value: number): string {
  const text = String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, currentLanguage() === 'en' ? ',' : '.');
  return value < 0 ? `-${text}` : text;
}
