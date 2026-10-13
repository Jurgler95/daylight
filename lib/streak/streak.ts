import { addDaysToDateString, daysBetween, type DateString } from '@/lib/dates';

import { entryDaysUpTo, runEndingAt } from './days';

/** A gap of up to this many days can still be filled in to bring the streak back. */
export const MAX_GAP_DAYS = 7;

export type StreakStatus = 'active' | 'atRisk' | 'broken' | 'none';

/** A gap of up to `MAX_GAP_DAYS` days, behind a broken streak or behind the run still going, that filling in closes. */
export interface StreakRescue {
  /**
   * The oldest day with an entry in the window before the gap, so a gap that was partly filled in
   * (even yesterday first) still counts as one, and the run before it is taken in full.
   */
  anchor: DateString;
  /** Days without an entry between the anchor and today, oldest first. */
  missing: DateString[];
  /** The length once every missing day is filled in, today included when it has an entry. */
  restoredDays: number;
  /** The run ending on the last day with an entry before the gap. */
  runBeforeGap: number;
}

export interface StreakState {
  /**
   * Relative to today, checked in this order:
   * `atRisk` yesterday is missing, the day before has an entry (whatever today holds);
   * `broken` yesterday and the day before are missing, but an entry lies at most `MAX_GAP_DAYS` days back;
   * `active` today or yesterday has an entry;
   * `none` otherwise.
   */
  status: StreakStatus;
  /**
   * `active`: the run ending today, or yesterday while today is empty (the achievement `days`).
   * `atRisk`: the run ending the day before yesterday, what filling in yesterday keeps.
   * `broken`: 1 when today has an entry, else 0.
   */
  days: number;
  todayDone: boolean;
  /** First day of the run counted in `days`, null while `days` is 0. */
  start: DateString | null;
  /** The days to fill in to save the streak, oldest first: yesterday for `atRisk`, else those of `rescue`. */
  missing: DateString[];
  /** The length once `missing` is filled in, today included when it has an entry. */
  restoredDays?: number;
  /**
   * `broken`, and `active` while a gap of up to `MAX_GAP_DAYS` days lies right before the run (when
   * a gap was filled in from the wrong end, yesterday first): what the rescue card offers.
   */
  rescue?: StreakRescue;
}

/**
 * Where the diary's streak stands today. A day counts with at least one entry of that date, so
 * filling in a missed day keeps or mends the streak. Days after today are ignored.
 */
export function entryStreak(entryDates: Iterable<string>, today: DateString): StreakState {
  const days = entryDaysUpTo(entryDates, today);
  const todayDone = days.has(today);
  const yesterday = addDaysToDateString(today, -1);
  const dayBefore = addDaysToDateString(today, -2);
  const startOf = (end: DateString, length: number) => (length > 0 ? addDaysToDateString(end, 1 - length) : null);

  if (!days.has(yesterday) && days.has(dayBefore)) {
    const run = runEndingAt(days, dayBefore);
    return { status: 'atRisk', days: run, todayDone, start: startOf(dayBefore, run), missing: [yesterday], restoredDays: run + 1 + (todayDone ? 1 : 0) };
  }

  if (!days.has(yesterday)) {
    const rescue = rescueBefore(days, today, addDaysToDateString(today, -3));
    if (rescue) return { status: 'broken', days: todayDone ? 1 : 0, todayDone, start: todayDone ? today : null, ...withRescue(rescue) };
    return todayDone
      ? { status: 'active', days: 1, todayDone, start: today, missing: [] }
      : { status: 'none', days: 0, todayDone, start: null, missing: [] };
  }

  const end = todayDone ? today : yesterday;
  const run = runEndingAt(days, end);
  const start = addDaysToDateString(end, 1 - run);
  // The day before the run is missing by definition; an entry before that, within reach, is a gap to close.
  const rescue = rescueBefore(days, today, addDaysToDateString(start, -2));
  return { status: 'active', days: run, todayDone, start, ...(rescue ? withRescue(rescue) : { missing: [] }) };
}

function withRescue(rescue: StreakRescue): Pick<StreakState, 'missing' | 'restoredDays' | 'rescue'> {
  return { missing: rescue.missing, restoredDays: rescue.restoredDays, rescue };
}

/** The gap whose last day with an entry before it lies on or before `to`, at most `MAX_GAP_DAYS` days back. */
function rescueBefore(days: ReadonlySet<string>, today: DateString, to: DateString): StreakRescue | null {
  const from = addDaysToDateString(today, -(MAX_GAP_DAYS + 1));
  const anchor = firstIn(days, from, to, 1);
  if (!anchor) return null;
  const missing: DateString[] = [];
  for (let day = addDaysToDateString(anchor, 1); day < today; day = addDaysToDateString(day, 1)) if (!days.has(day)) missing.push(day);
  return {
    anchor,
    missing,
    restoredDays: runEndingAt(days, anchor) + daysBetween(anchor, today) - 1 + (days.has(today) ? 1 : 0),
    runBeforeGap: runEndingAt(days, firstIn(days, to, from, -1) ?? anchor),
  };
}

/** The first day in `days` walking from `from` to `to` (both included) in steps of `step`. */
function firstIn(days: ReadonlySet<string>, from: DateString, to: DateString, step: 1 | -1): DateString | null {
  for (let day = from; step > 0 ? day <= to : day >= to; day = addDaysToDateString(day, step)) if (days.has(day)) return day;
  return null;
}
