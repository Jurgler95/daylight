/** German display of the health values; pure, so Heute, Verlauf and tests agree. */

import type { HealthMetric } from '@/lib/insights/healthStats';

/** "8.412": dot as thousands separator, independent of the device's Intl data. */
export function formatSteps(steps: number): string {
  return String(Math.round(steps)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "7 h 20 min", "45 min", "8 h". */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "7:20 h", the short form for one line in the timeline. */
export function formatDurationShort(minutes: number): string {
  const total = Math.round(minutes);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} h`;
}

/** "72 bpm". */
export function formatBpm(bpm: number): string {
  return `${Math.round(bpm)} bpm`;
}

/** One value of a metric as the insights show it. */
export function formatMetric(metric: HealthMetric, value: number): string {
  switch (metric) {
    case 'sleep':
    case 'exercise':
      return formatDuration(value);
    case 'steps':
      return formatSteps(value);
    case 'restingHr':
      return formatBpm(value);
  }
}

/** "+1.200", "-35 min", "+2 bpm": a difference with its sign; zero without one. */
export function formatMetricDifference(metric: HealthMetric, difference: number): string {
  const text = formatMetric(metric, Math.abs(difference));
  if (Math.round(difference) === 0) return formatMetric(metric, 0);
  return `${difference > 0 ? '+' : '-'}${text}`;
}
