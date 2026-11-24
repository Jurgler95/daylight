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
 * Two kinds: `daily` in the evening, skipped once the day has an entry (unless `always`), and `yesterday` in the
 * morning of a day D whose D-1 is still empty while D-2 has an entry. That condition holds for one
 * morning per gap only, so a gap brings at most one morning reminder.
 *
 * Apart from those, on its own switch: `outlook` on the morning of a day the hint for a good next day
 * pointed at, the evening before (`lib/outlook/tomorrow.ts`). It never says what the hint said, only
 * that it is there, and stays away once that day has an entry.
 */

/** Days planned ahead. Whoever does not open the app for two weeks stops being reminded. */
export const REMINDER_DAYS = 14;

/** The app's URL scheme (`app.json`). A tap on a reminder opens the editor through it. */
export const APP_SCHEME = 'daylight';

export type ReminderKind = 'daily' | 'yesterday' | 'outlook';

export interface PlannedReminder {
  /** Stable identity, `daily:`, `yesterday:` or `outlook:` and the day it fires, `YYYY-MM-DD`. */
  key: string;
  kind: ReminderKind;
  date: DateString;
  hour: number;
  minute: number;
  /** The day a tap opens in the editor: the day itself in the evening, the day before in the morning; null opens "Heute" on today. */
  openDate: DateString | null;
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
  /** "Dein Ausblick für heute ist da": never what the hint says, it would sit on the lock screen. */
  outlook: string;
}

export interface PlanInput {
  today: DateString;
  /** Minutes since midnight, so a time that already passed today is not scheduled for today. */
  nowMinutes: number;
  /** The daily evening reminder; the morning one only comes along while this is on. */
  enabled: boolean;
  /** "HH:mm". */
  time: string;
  /** The evening reminder comes even when the day already has an entry. */
  always?: boolean;
  yesterdayEnabled: boolean;
  /** "HH:mm" of the morning reminder. */
  yesterdayTime: string;
  /** The morning outlook notification; null while it or the outlook is off. */
  outlook?: {
    /** "HH:mm". */
    time: string;
    /** Days on which the hint for a good next day was on screen, so the day after it gets a notification. */
    hintDays: ReadonlySet<string>;
  } | null;
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

/** "Heute" on today, wherever the app was left (`app/today.tsx`). */
export const TODAY_LINK = `${APP_SCHEME}://today`;

/** What a tap on `reminder` opens: the editor for its day, or "Heute" for the outlook. */
export function reminderLink(reminder: PlannedReminder): string {
  return reminder.openDate ? entryLink(reminder.openDate) : TODAY_LINK;
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
  const skipToday = !input.always && input.entryDays.has(input.today);
  const planned: PlannedReminder[] = [];
  for (let offset = 0; offset < REMINDER_DAYS; offset += 1) {
    if (offset === 0 && (skipToday || time.hour * 60 + time.minute <= input.nowMinutes)) continue;
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

/**
 * The mornings after a shown hint, judged from what is known today (T): T+1 once the hint was shown
 * today, and T itself while yesterday's hint stands, today is still empty and the time is ahead.
 * The hint needs today's entry, so T+1 never has one yet; an entry on T+1 plans again anyway.
 */
export function outlookCandidates(hintDays: ReadonlySet<string>, entryDays: ReadonlySet<string>, today: DateString, timeAhead: boolean): DateString[] {
  const dates: DateString[] = [];
  if (timeAhead && hintDays.has(addDaysToDateString(today, -1)) && !entryDays.has(today)) dates.push(today);
  if (hintDays.has(today)) dates.push(addDaysToDateString(today, 1));
  return dates;
}

function outlookReminders(input: PlanInput): PlannedReminder[] {
  if (!input.outlook) return [];
  const time = parseTime(input.outlook.time);
  if (!time) return [];
  return outlookCandidates(input.outlook.hintDays, input.entryDays, input.today, time.hour * 60 + time.minute > input.nowMinutes).map((date) => ({
    key: `outlook:${date}`,
    kind: 'outlook',
    date,
    hour: time.hour,
    minute: time.minute,
    openDate: null,
    // One line only: the title says it all, nothing of the hint itself reaches the lock screen.
    title: input.wording.outlook,
    body: '',
  }));
}

/** The evening and morning reminders come with `enabled`; the outlook one has its own switch. */
export function planReminders(input: PlanInput): PlannedReminder[] {
  return [...(input.enabled ? [...dailyReminders(input), ...yesterdayReminders(input)] : []), ...outlookReminders(input)];
}

/**
 * Keys of reminders that may still be on screen although their day is done: the evening one of a
 * day that has an entry now, the morning one whose yesterday was filled in, the outlook of a day
 * that has its entry. Removing a key that
 * shows nothing is harmless, so the last `REMINDER_DAYS` days are all named.
 */
export function doneReminderKeys(entryDays: ReadonlySet<string>, today: DateString): string[] {
  const keys: string[] = [];
  for (let offset = -(REMINDER_DAYS - 1); offset <= 0; offset += 1) {
    const date = addDaysToDateString(today, offset);
    if (entryDays.has(date)) keys.push(`daily:${date}`);
    if (entryDays.has(addDaysToDateString(date, -1))) keys.push(`yesterday:${date}`);
    if (entryDays.has(date)) keys.push(`outlook:${date}`);
  }
  return keys;
}

/** The wall-clock time a reminder is meant for, "YYYY-MM-DDTHH:mm", handed to the native module. */
export function localTrigger(reminder: PlannedReminder): string {
  return `${reminder.date}T${formatTime(reminder.hour, reminder.minute)}`;
}

/**
 * Stable signature of a plan, so the device is only reprogrammed when something changed. The text
 * belongs to it: a streak that grew by a day has to reach the scheduled reminder. So does the time
 * zone (`zone`, see `timeZoneKey`): the scheduled times are absolute, after a move 20:30 would
 * otherwise ring at the old zone's 20:30.
 */
export function planSignature(planned: readonly PlannedReminder[], zone = ''): string {
  const lines = planned.map((r) => `${r.key}@${formatTime(r.hour, r.minute)}>${r.openDate ?? ''}#${r.title}#${r.body}`).sort();
  return planned.length === 0 ? '' : [`zone:${zone}`, ...lines].join('\n');
}

/**
 * The device's time zone as it bears on the plan: its name where Intl knows it, plus the current
 * offset, so a change of either reschedules. A switch to or from summer time changes the offset
 * too; rescheduling then is harmless.
 */
export function timeZoneKey(now: Date = new Date()): string {
  let name = '';
  try {
    name = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    // Without Intl the offset alone has to do.
  }
  return `${name}${now.getTimezoneOffset()}`;
}
