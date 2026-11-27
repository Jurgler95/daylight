import type { Scale } from '@/db/schema';
import { formatDuration } from '@/lib/health/format';
import { formatDecimal } from '@/lib/insights/format';

/** What formatting needs from a scale; unit and decimals only matter for a number scale. */
export type ScaleFormat = Pick<Scale, 'kind'> & Partial<Pick<Scale, 'unit' | 'decimals'>>;

function withUnit(scale: ScaleFormat, text: string): string {
  return scale.unit ? `${text} ${scale.unit}` : text;
}

/**
 * A scale value as the insights show it: "3,4" for a rating, "2 h 15 min" for a duration, "72,4 kg"
 * for a number. Number means keep at least one decimal, so 2 and 3 glasses average to "2,5".
 */
export function formatScaleValue(scale: ScaleFormat, value: number): string {
  if (scale.kind === 'duration') return formatDuration(value);
  if (scale.kind === 'number') return withUnit(scale, formatDecimal(value, Math.max(1, scale.decimals ?? 0)));
  return formatDecimal(value, 1);
}

/** One entry's value exactly as entered: "4" of a rating, "72,4 kg" with the scale's decimals. */
export function formatEntryValue(scale: ScaleFormat, value: number): string {
  if (scale.kind === 'duration') return formatDuration(value);
  if (scale.kind === 'number') return withUnit(scale, formatDecimal(value, scale.decimals ?? 0));
  return String(value);
}

/** "+0,8", "-45 min" or "-1,2 kg"; zero without a sign. */
export function formatScaleDifference(scale: ScaleFormat, difference: number): string {
  const text = formatScaleValue(scale, Math.abs(difference));
  if (text === formatScaleValue(scale, 0)) return text;
  return `${difference > 0 ? '+' : '-'}${text}`;
}
