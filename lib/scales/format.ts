import type { Scale } from '@/db/schema';
import { formatDuration } from '@/lib/health/format';
import { formatDecimal } from '@/lib/insights/format';

type Kind = Pick<Scale, 'kind'>;

/** A scale value as the insights show it: "3,4" for a rating, "2 h 15 min" for a duration. */
export function formatScaleValue(scale: Kind, value: number): string {
  return scale.kind === 'duration' ? formatDuration(value) : formatDecimal(value, 1);
}

/** "+0,8" or "-45 min"; zero without a sign. */
export function formatScaleDifference(scale: Kind, difference: number): string {
  const text = formatScaleValue(scale, Math.abs(difference));
  if (text === formatScaleValue(scale, 0)) return text;
  return `${difference > 0 ? '+' : '-'}${text}`;
}
