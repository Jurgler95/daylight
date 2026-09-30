import { addDaysToDateString, weekdayOf, type DateString } from '@/lib/dates';
import type { InsightDay } from '@/lib/insights';

/** How far back a habit is looked for: the last eight weeks, as in the specification. */
export const RECURRING_WEEKS = 8;
/** Share of those weekdays (with an entry) that must carry the activity. */
export const RECURRING_SHARE = 0.7;
/** Fewer recorded weekdays than this in the window say nothing about a habit. */
export const RECURRING_MIN_DAYS = 4;
/**
 * The activity must be tied to the weekday: its share there has to lie this far above its share
 * on the other days of the window. Without it "zu Hause", poor sleep or sunshine would count as
 * recurring on every weekday, which is a description of the diary, not a plan for a day.
 */
export const RECURRING_CONTRAST = 0.25;

/**
 * Activities that recur on the weekday of `target`, judged from the eight weeks up to `cutoff`
 * (inclusive). `days` may contain later days; they are ignored.
 */
export function recurringActivities(days: readonly InsightDay[], cutoff: DateString, target: DateString): number[] {
  const from = addDaysToDateString(cutoff, -(RECURRING_WEEKS * 7 - 1));
  const weekday = weekdayOf(target);
  const same = new Map<number, number>();
  const other = new Map<number, number>();
  let sameDays = 0;
  let otherDays = 0;
  for (const day of days) {
    if (day.date < from || day.date > cutoff) continue;
    const onWeekday = weekdayOf(day.date) === weekday;
    if (onWeekday) sameDays += 1;
    else otherDays += 1;
    const counts = onWeekday ? same : other;
    for (const id of day.activities) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  if (sameDays < RECURRING_MIN_DAYS) return [];
  const result: number[] = [];
  for (const [id, n] of same) {
    const share = n / sameDays;
    const otherShare = otherDays ? (other.get(id) ?? 0) / otherDays : 0;
    if (share >= RECURRING_SHARE && share - otherShare >= RECURRING_CONTRAST) result.push(id);
  }
  return result.sort((a, b) => a - b);
}
