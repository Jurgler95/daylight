import { addDaysToDateString, daysBetween, type DateString } from '@/lib/dates';

/** The last this many days are looked at, today included. */
export const LOW_MOOD_WINDOW = 10;
/** This many of them at level 2 or below bring up the note. */
export const LOW_MOOD_DAYS = 7;
export const LOW_MOOD_LEVEL = 2;
/** "Later" hides the note for two weeks. */
export const LOW_MOOD_SNOOZE_DAYS = 14;

export interface LowMoodInput {
  /** Rounded level of each day with entries (the calendar's rule). Days outside the window are ignored. */
  levels: ReadonlyMap<DateString, number>;
  today: DateString;
  /** Day the note was last put away, or null. */
  dismissedOn: DateString | null;
}

/** Days in the window at level 2 or below. */
export function lowDays(levels: ReadonlyMap<DateString, number>, today: DateString): number {
  let low = 0;
  for (let i = 0; i < LOW_MOOD_WINDOW; i += 1) {
    const level = levels.get(addDaysToDateString(today, -i));
    if (level !== undefined && level <= LOW_MOOD_LEVEL) low += 1;
  }
  return low;
}

/**
 * Whether "Heute" shows the quiet note that talking helps. Seven of the last ten days at level 2 or
 * below, and not put away within the last fourteen days. Days without an entry count as not low:
 * nothing is read into a gap.
 */
export function showLowMoodNote({ levels, today, dismissedOn }: LowMoodInput): boolean {
  if (dismissedOn && daysBetween(dismissedOn, today) < LOW_MOOD_SNOOZE_DAYS) return false;
  return lowDays(levels, today) >= LOW_MOOD_DAYS;
}
