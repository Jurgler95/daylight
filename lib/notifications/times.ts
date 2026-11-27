/**
 * The times of the daily reminder: one to five "HH:mm" a day, never the same one twice, always in
 * ascending order. Stored as a list in `settings.reminder_times`; `settings.reminder_time` follows
 * with the latest of them, so an older app version reading a newer backup still finds one time.
 * Plain functions without imports, so the database layer, the backup and the screens share them.
 */

export const MAX_REMINDER_TIMES = 5;

/** The time a fresh installation starts with, the same as the column default. */
export const DEFAULT_REMINDER_TIME = '20:30';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Whatever came in (a backup, an older row) as a valid list: entries that are no "HH:mm" and
 * repeated ones go, the first `MAX_REMINDER_TIMES` stay, sorted. Empty when nothing usable is left.
 */
export function cleanReminderTimes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const times: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !TIME.test(item) || times.includes(item)) continue;
    times.push(item);
    if (times.length === MAX_REMINDER_TIMES) break;
  }
  return times.sort();
}

/** The cleaned list, or the single `fallback` time when it has nothing usable. */
export function reminderTimesOr(value: unknown, fallback: string): string[] {
  const times = cleanReminderTimes(value);
  if (times.length > 0) return times;
  return [TIME.test(fallback) ? fallback : DEFAULT_REMINDER_TIME];
}

/** The latest time of a sorted list: what `reminder_time` holds and what a late entry defaults to. */
export function latestReminderTime(times: readonly string[]): string {
  return times[times.length - 1] ?? DEFAULT_REMINDER_TIME;
}

export type TimeListChange = { ok: true; times: string[] } | { ok: false; reason: 'duplicate' | 'full' | 'last' };

/** Adds a time, unless it is already there or the list is full. */
export function addReminderTime(times: readonly string[], time: string): TimeListChange {
  if (times.includes(time)) return { ok: false, reason: 'duplicate' };
  if (times.length >= MAX_REMINDER_TIMES) return { ok: false, reason: 'full' };
  return { ok: true, times: [...times, time].sort() };
}

/** Moves one time to another; the same time again changes nothing, another one of the list is refused. */
export function changeReminderTime(times: readonly string[], from: string, to: string): TimeListChange {
  if (from === to) return { ok: true, times: [...times] };
  if (times.includes(to)) return { ok: false, reason: 'duplicate' };
  return { ok: true, times: times.map((time) => (time === from ? to : time)).sort() };
}

/** Removes a time; the last one stays, the switch is what turns the reminder off. */
export function removeReminderTime(times: readonly string[], time: string): TimeListChange {
  if (times.length <= 1) return { ok: false, reason: 'last' };
  return { ok: true, times: times.filter((value) => value !== time) };
}

/** A time to start the picker on when adding one: the first of a few round ones not taken yet. */
export function suggestReminderTime(times: readonly string[]): string {
  return ['12:00', '09:00', '15:00', '18:00', '21:00', '07:00'].find((time) => !times.includes(time)) ?? '12:00';
}
