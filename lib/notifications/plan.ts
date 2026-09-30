import { addDaysToDateString, type DateString } from '@/lib/dates';

/**
 * Pure planning of the daily reminder. No expo-notifications import, no database: the same plan is
 * produced in tests and on the device.
 *
 * A repeating daily trigger cannot skip a single day, but the reminder has to stay away on days that
 * already have an entry. So the plan consists of one-off reminders for the coming days, rebuilt on
 * every start, every return to the app and every write.
 */

/** Days planned ahead. Whoever does not open the app for two weeks stops being reminded. */
export const REMINDER_DAYS = 14;

export interface PlannedReminder {
  /** Stable identity, `daily:YYYY-MM-DD`. */
  key: string;
  date: DateString;
  hour: number;
  minute: number;
}

export interface PlanInput {
  today: DateString;
  /** Minutes since midnight, so a time that already passed today is not scheduled for today. */
  nowMinutes: number;
  enabled: boolean;
  /** "HH:mm". */
  time: string;
  /** True once today has an entry; today's reminder is then dropped. */
  hasEntryToday: boolean;
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

export function planReminders(input: PlanInput): PlannedReminder[] {
  if (!input.enabled) return [];
  const time = parseTime(input.time);
  if (!time) return [];
  const planned: PlannedReminder[] = [];
  for (let offset = 0; offset < REMINDER_DAYS; offset += 1) {
    if (offset === 0 && (input.hasEntryToday || time.hour * 60 + time.minute <= input.nowMinutes)) continue;
    const date = addDaysToDateString(input.today, offset);
    planned.push({ key: `daily:${date}`, date, hour: time.hour, minute: time.minute });
  }
  return planned;
}

/** Stable signature of a plan, so the device is only reprogrammed when something changed. */
export function planSignature(planned: readonly PlannedReminder[]): string {
  return planned
    .map((r) => `${r.key}@${formatTime(r.hour, r.minute)}`)
    .sort()
    .join('|');
}
