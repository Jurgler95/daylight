import { addDaysToDateString, type DateString } from '@/lib/dates';
import { runEndingAt } from '@/lib/streak/days';

/**
 * Pure planning of the reminders. No native module, no database: the same plan is produced in
 * tests and on the device.
 *
 * A repeating daily trigger cannot skip a single day, but the reminder has to stay away on days that
 * already have an entry. So the plan consists of one-off reminders for the coming days, rebuilt on
 * every start, every return to the app and every write.
 *
 * Two kinds: `daily` in the evening, skipped once the day has an entry, and `yesterday` in the
 * morning of a day D whose D-1 is still empty while D-2 has an entry. That condition holds for one
 * morning per gap only, so a gap brings at most one morning reminder.
 */

/** Days planned ahead. Whoever does not open the app for two weeks stops being reminded. */
export const REMINDER_DAYS = 14;

/** The app's URL scheme (`app.json`). A tap on a reminder opens the editor through it. */
export const APP_SCHEME = 'daylight';

export type ReminderKind = 'daily' | 'yesterday';

export interface PlannedReminder {
  /** Stable identity, `daily:YYYY-MM-DD` or `yesterday:YYYY-MM-DD` (the day it fires). */
  key: string;
  kind: ReminderKind;
  date: DateString;
  hour: number;
  minute: number;
  /** The day a tap opens in the editor: the day itself in the evening, the day before in the morning. */
  openDate: DateString;
  title: string;
  body: string;
}

/** The words of a reminder, handed in so the plan stays free of i18n. */
export interface ReminderWording {
  title: string;
  /** `streakDay` is the day of the streak the evening would make, null for the general text. */
  daily: (streakDay: number | null) => string;
  /** `keptDays` is the streak that filling in yesterday keeps, null for the general text. */
  yesterday: (keptDays: number | null) => string;
}

export interface PlanInput {
  today: DateString;
  /** Minutes since midnight, so a time that already passed today is not scheduled for today. */
  nowMinutes: number;
  /** The daily evening reminder; the morning one only comes along while this is on. */
  enabled: boolean;
  /** "HH:mm". */
  time: string;
  yesterdayEnabled: boolean;
  /** "HH:mm" of the morning reminder. */
  yesterdayTime: string;
  /** Every day with an entry. Days after today are never looked at. */
  entryDays: ReadonlySet<string>;
  wording: ReminderWording;
}

export function parseTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** The link a reminder opens: the editor for that day (`app/entry/new.tsx`). */
export function entryLink(date: DateString): string {
  return `${APP_SCHEME}://entry/new?date=${date}`;
}

/**
 * The evening reminder on `date` names the streak it continues: the run up to the day before plus
 * this day. Only from day 2 on, and only when the day before has an entry.
 */
function streakDayOn(days: ReadonlySet<string>, date: DateString): number | null {
  const run = runEndingAt(days, addDaysToDateString(date, -1));
  return run >= 1 ? run + 1 : null;
}

function dailyReminders(input: PlanInput): PlannedReminder[] {
  const time = parseTime(input.time);
  if (!time) return [];
  const hasEntryToday = input.entryDays.has(input.today);
  const planned: PlannedReminder[] = [];
  for (let offset = 0; offset < REMINDER_DAYS; offset += 1) {
    if (offset === 0 && (hasEntryToday || time.hour * 60 + time.minute <= input.nowMinutes)) continue;
    const date = addDaysToDateString(input.today, offset);
    // Only the next one carries the number; further ahead it could be stale by the time it fires.
    const streakDay = planned.length === 0 ? streakDayOn(input.entryDays, date) : null;
    planned.push({
      key: `daily:${date}`,
      kind: 'daily',
      date,
      hour: time.hour,
      minute: time.minute,
      openDate: date,
      title: input.wording.title,
      body: input.wording.daily(streakDay),
    });
  }
  return planned;
}

/**
 * The mornings that may need a reminder, judged from what is known today (T):
 * T itself when T-1 is empty and T-2 has an entry, and the time is still ahead;
 * T+1 when T is still empty and T-1 has an entry;
 * T+2 when T has an entry (T+1 counts as empty; an entry there plans again anyway).
 * T+1 and T+2 exclude each other, so at most two mornings, like {T, T+2}.
 */
export function yesterdayCandidates(entryDays: ReadonlySet<string>, today: DateString, timeAhead: boolean): DateString[] {
  const has = (offset: number) => entryDays.has(addDaysToDateString(today, offset));
  const dates: DateString[] = [];
  if (timeAhead && !has(-1) && has(-2)) dates.push(today);
  if (has(0)) dates.push(addDaysToDateString(today, 2));
  else if (has(-1)) dates.push(addDaysToDateString(today, 1));
  return dates;
}

function yesterdayReminders(input: PlanInput): PlannedReminder[] {
  if (!input.yesterdayEnabled) return [];
  const time = parseTime(input.yesterdayTime);
  if (!time) return [];
  const dates = yesterdayCandidates(input.entryDays, input.today, time.hour * 60 + time.minute > input.nowMinutes);
  return dates.map((date, index) => {
    // The streak that filling in D-1 keeps is the run ending on D-2, a day that lies at most today.
    const kept = index === 0 ? runEndingAt(input.entryDays, addDaysToDateString(date, -2)) : 0;
    return {
      key: `yesterday:${date}`,
      kind: 'yesterday',
      date,
      hour: time.hour,
      minute: time.minute,
      openDate: addDaysToDateString(date, -1),
      title: input.wording.title,
      body: input.wording.yesterday(kept >= 1 ? kept : null),
    };
  });
}

export function planReminders(input: PlanInput): PlannedReminder[] {
  if (!input.enabled) return [];
  return [...dailyReminders(input), ...yesterdayReminders(input)];
}

/**
 * Keys of reminders that may still be on screen although their day is done: the evening one of a
 * day that has an entry now, the morning one whose yesterday was filled in. Removing a key that
 * shows nothing is harmless, so the last `REMINDER_DAYS` days are all named.
 */
export function doneReminderKeys(entryDays: ReadonlySet<string>, today: DateString): string[] {
  const keys: string[] = [];
  for (let offset = -(REMINDER_DAYS - 1); offset <= 0; offset += 1) {
    const date = addDaysToDateString(today, offset);
    if (entryDays.has(date)) keys.push(`daily:${date}`);
    if (entryDays.has(addDaysToDateString(date, -1))) keys.push(`yesterday:${date}`);
  }
  return keys;
}

/**
 * Stable signature of a plan, so the device is only reprogrammed when something changed. The text
 * belongs to it: a streak that grew by a day has to reach the scheduled reminder.
 */
export function planSignature(planned: readonly PlannedReminder[]): string {
  return planned
    .map((r) => `${r.key}@${formatTime(r.hour, r.minute)}>${r.openDate}#${r.title}#${r.body}`)
    .sort()
    .join('\n');
}
