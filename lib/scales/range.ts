/**
 * The value axis for a number scale, which has no range of its own: it hugs the values with a tenth
 * of their spread to spare on both sides, so 71,8 to 73,1 kg reads as movement, not as a flat line
 * high above zero. One step of the last decimal at least, so equal values still get an axis.
 */
export function numberChartRange(values: readonly number[], decimals = 0): [number, number] {
  if (values.length === 0) return [0, 1];
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = Math.max((high - low) * 0.1, 10 ** -decimals);
  return [low - pad, high + pad];
}
