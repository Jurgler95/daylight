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

/** "4,3": German decimal comma, fixed digits. */
export function formatDecimal(value: number, digits = 1): string {
  return roundDecimal(value, digits).toFixed(digits).replace('.', ',');
}

/** "+0,4" or "-0,2"; zero without a sign. */
export function formatSigned(value: number, digits = 1): string {
  const text = formatDecimal(Math.abs(value), digits);
  if (Number(text.replace(',', '.')) === 0) return formatDecimal(0, digits);
  return `${value > 0 ? '+' : '-'}${text}`;
}

/** "74 %" for a share 0..1, whole percent. */
export function formatPercent(share: number): string {
  return `${roundDecimal(share * 100, 0)} %`;
}

/** "1,8" for a ratio, one decimal. */
export function formatRatio(ratio: number): string {
  return formatDecimal(ratio, 1);
}
