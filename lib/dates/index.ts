import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isMatch, isValid, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { de } from 'date-fns/locale';

/** A calendar day as "YYYY-MM-DD". Compared lexicographically, never via timestamps. */
export type DateString = string & { readonly __brand: 'DateString' };

const PATTERN = 'yyyy-MM-dd';

export function isDateString(value: string): value is DateString {
  return isMatch(value, PATTERN) && isValid(parseISO(value)) && value.length === 10;
}

export function toDateString(date: Date): DateString {
  return format(date, PATTERN) as DateString;
}

export function today(): DateString {
  return toDateString(new Date());
}

/** Parses at local midnight, so the calendar day never drifts across timezones. */
export function parseDateString(value: DateString): Date {
  return parseISO(value);
}

const MS_PER_DAY = 86_400_000;

/**
 * Days since the epoch, counted on the UTC calendar so there is no DST to trip over.
 * The engines call this thousands of times per render, which is why it skips date-fns.
 */
function dayNumber(value: DateString): number {
  return Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))) / MS_PER_DAY;
}

export function addDaysToDateString(value: DateString, days: number): DateString {
  return new Date((dayNumber(value) + days) * MS_PER_DAY).toISOString().slice(0, 10) as DateString;
}

export function addMonthsToDateString(value: DateString, months: number): DateString {
  return toDateString(addMonths(parseDateString(value), months));
}

/** The first day of the month of `value`. */
export function startOfMonthString(value: DateString): DateString {
  return toDateString(startOfMonth(parseDateString(value)));
}

/** Every day of the complete weeks that cover the month of `month`, 28 to 42 days, oldest first. */
export function monthWeekDays(month: DateString, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6): DateString[] {
  const first = startOfMonth(parseDateString(month));
  return eachDayOfInterval({ start: startOfWeek(first, { weekStartsOn }), end: endOfWeek(endOfMonth(first), { weekStartsOn }) }).map(toDateString);
}

export function compareDateStrings(a: DateString, b: DateString): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function formatLong(value: DateString): string {
  return format(parseDateString(value), 'EEEE, d. MMMM', { locale: de });
}

export function formatShort(value: DateString): string {
  return format(parseDateString(value), 'd. MMM', { locale: de });
}

/** "Mo", "Di" ... for the horizontal day strip. */
export function formatWeekdayShort(value: DateString): string {
  return format(parseDateString(value), 'EEEEEE', { locale: de });
}

export function formatMonthYear(value: DateString): string {
  return format(parseDateString(value), 'MMMM yyyy', { locale: de });
}

export function daysBetween(from: DateString, to: DateString): number {
  return dayNumber(to) - dayNumber(from);
}

/** 0 = Sunday ... 6 = Saturday, like `Date.getDay`. */
export function weekdayOf(value: DateString): number {
  return (((dayNumber(value) + 4) % 7) + 7) % 7;
}

/**
 * "14. bis 17. März", "30. März bis 2. Apr." when the months differ, with years when the years
 * differ. Written out, no dash (house style).
 */
export function formatRange(from: DateString, to: DateString): string {
  if (from === to) return formatShort(from);
  const a = parseDateString(from);
  const b = parseDateString(to);
  if (a.getFullYear() !== b.getFullYear()) return `${formatShortWithYear(from)} bis ${formatShortWithYear(to)}`;
  if (a.getMonth() === b.getMonth()) return `${format(a, 'd.')} bis ${format(b, 'd. MMM', { locale: de })}`;
  return `${formatShort(from)} bis ${formatShort(to)}`;
}

/** "14. Sep. 26", for compact lists that span years. */
export function formatShortWithYear(value: DateString): string {
  return format(parseDateString(value), 'd. MMM yy', { locale: de });
}

/** Short weekday names ("Mo", "Di", ...) starting from the given first day of the week (0 = Sunday). */
export function weekdayLabels(weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6): string[] {
  const start = startOfWeek(new Date(2026, 0, 4), { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'EEEEEE', { locale: de }));
}

/** "29.12.2025", for summaries that name exact days. */
export function formatNumeric(value: DateString): string {
  return format(parseDateString(value), 'dd.MM.yyyy');
}

/** "25. September", the `date` column of a German Daylio export. */
export function formatDayMonth(value: DateString): string {
  return format(parseDateString(value), 'd. MMMM', { locale: de });
}

/** "Freitag", the `weekday` column of a German Daylio export. */
export function formatWeekdayLong(value: DateString): string {
  return format(parseDateString(value), 'EEEE', { locale: de });
}

/** The current local time as "HH:mm". */
export function nowTime(): string {
  return format(new Date(), 'HH:mm');
}

/** "HH:mm" of a Date, for the time picker. */
export function toTimeString(date: Date): string {
  return format(date, 'HH:mm');
}

/** A Date at the given day and "HH:mm", local time, for handing to the system pickers. */
export function toLocalDate(day: DateString, time = '12:00'): Date {
  const date = parseDateString(day);
  date.setHours(Number(time.slice(0, 2)), Number(time.slice(3, 5)), 0, 0);
  return date;
}

/** "Jan", "Feb", "Mär": stand-alone month name, abbreviated, for chart axes. */
export function formatMonthShort(value: DateString): string {
  return format(parseDateString(value), 'LLL', { locale: de }).replace('.', '');
}

/** "Januar", stand-alone, for screen reader text. */
export function formatMonthLong(value: DateString): string {
  return format(parseDateString(value), 'LLLL', { locale: de });
}

/** "J", "F", "M": one letter per month, for the year in pixels. */
export function formatMonthNarrow(value: DateString): string {
  return format(parseDateString(value), 'LLLLL', { locale: de });
}
