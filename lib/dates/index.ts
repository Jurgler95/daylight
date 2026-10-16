import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isMatch, isValid, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { de, enUS, es, fr, it, ptBR, type Locale } from 'date-fns/locale';

import { currentLanguage, type Language } from '@/lib/i18n/language';

/** A calendar day as "YYYY-MM-DD". Compared lexicographically, never via timestamps. */
export type DateString = string & { readonly __brand: 'DateString' };

const PATTERN = 'yyyy-MM-dd';

/**
 * Display patterns per language. English keeps the house style: written out, no dash. `to` joins
 * the two ends of a range; English names the month first, every other language the day.
 */
const PATTERNS = {
  de: { long: 'EEEE, d. MMMM', short: 'd. MMM', shortWithYear: 'd. MMM yy', numeric: 'dd.MM.yyyy', dayMonth: 'd. MMMM', dayOnly: 'd.', monthYear: 'MMMM yyyy', to: 'bis' },
  en: { long: 'EEEE, MMMM d', short: 'MMM d', shortWithYear: "MMM d ''yy", numeric: 'MMM d, yyyy', dayMonth: 'MMMM d', dayOnly: 'd', monthYear: 'MMMM yyyy', to: 'to' },
  es: { long: "EEEE, d 'de' MMMM", short: 'd MMM', shortWithYear: 'd MMM yyyy', numeric: 'dd/MM/yyyy', dayMonth: "d 'de' MMMM", dayOnly: 'd', monthYear: "MMMM 'de' yyyy", to: 'al' },
  pt: { long: "EEEE, d 'de' MMMM", short: 'd MMM', shortWithYear: 'd MMM yyyy', numeric: 'dd/MM/yyyy', dayMonth: "d 'de' MMMM", dayOnly: 'd', monthYear: "MMMM 'de' yyyy", to: 'a' },
  fr: { long: 'EEEE d MMMM', short: 'd MMM', shortWithYear: 'd MMM yyyy', numeric: 'dd/MM/yyyy', dayMonth: 'd MMMM', dayOnly: 'd', monthYear: 'MMMM yyyy', to: 'au' },
  it: { long: 'EEEE d MMMM', short: 'd MMM', shortWithYear: 'd MMM yyyy', numeric: 'dd/MM/yyyy', dayMonth: 'd MMMM', dayOnly: 'd', monthYear: 'MMMM yyyy', to: 'al' },
} as const satisfies Record<Language, Record<string, string>>;

const LOCALES: Record<Language, Locale> = { de, en: enUS, es, pt: ptBR, fr, it };

function locale(language: Language = currentLanguage()) {
  return LOCALES[language];
}

function patterns(language: Language = currentLanguage()) {
  return PATTERNS[language];
}

/**
 * Spanish, Portuguese, French and Italian write weekdays and months in lower case. Where a name
 * stands alone, as a heading, an axis label or a column of the day strip, it starts upper case.
 */
function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

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
  return capitalized(format(parseDateString(value), patterns().long, { locale: locale() }));
}

export function formatShort(value: DateString): string {
  return format(parseDateString(value), patterns().short, { locale: locale() });
}

/** date-fns spells the Portuguese Saturday "sab"; Brazilian usage writes it with the accent. */
function weekdayShort(date: Date): string {
  const text = format(date, 'EEEEEE', { locale: locale() });
  return capitalized(currentLanguage() === 'pt' && text === 'sab' ? 'sáb' : text);
}

/** "Mo", "Di" ... for the horizontal day strip. */
export function formatWeekdayShort(value: DateString): string {
  return weekdayShort(parseDateString(value));
}

export function formatMonthYear(value: DateString): string {
  return capitalized(format(parseDateString(value), patterns().monthYear, { locale: locale() }));
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
  const { to: word, dayOnly, short } = patterns();
  if (a.getFullYear() !== b.getFullYear()) return `${formatShortWithYear(from)} ${word} ${formatShortWithYear(to)}`;
  if (a.getMonth() === b.getMonth()) {
    // "14. bis 17. März", but "Mar 14 to 17": English names the month first.
    return currentLanguage() === 'en'
      ? `${format(a, short, { locale: enUS })} ${word} ${format(b, dayOnly)}`
      : `${format(a, dayOnly)} ${word} ${format(b, short, { locale: locale() })}`;
  }
  return `${formatShort(from)} ${word} ${formatShort(to)}`;
}

/** "14. Sep. 26", for compact lists that span years. */
export function formatShortWithYear(value: DateString): string {
  return format(parseDateString(value), patterns().shortWithYear, { locale: locale() });
}

/** Short weekday names ("Mo", "Di", ...) starting from the given first day of the week (0 = Sunday). */
export function weekdayLabels(weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6): string[] {
  const start = startOfWeek(new Date(2026, 0, 4), { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => weekdayShort(addDays(start, i)));
}

/** "29.12.2025" or "Dec 29, 2025", for summaries that name exact days. */
export function formatNumeric(value: DateString): string {
  return format(parseDateString(value), patterns().numeric, { locale: locale() });
}

/** "25. September" or "September 25", also the `date` column of a Daylio export in that language. */
export function formatDayMonth(value: DateString): string {
  return format(parseDateString(value), patterns().dayMonth, { locale: locale() });
}

/** "Freitag" or "Friday", also the `weekday` column of a Daylio export in that language. */
export function formatWeekdayLong(value: DateString): string {
  return format(parseDateString(value), 'EEEE', { locale: locale() });
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
  return capitalized(format(parseDateString(value), 'LLL', { locale: locale() }).replace('.', ''));
}

/** "Januar", stand-alone, for screen reader text. */
export function formatMonthLong(value: DateString): string {
  return capitalized(format(parseDateString(value), 'LLLL', { locale: locale() }));
}

/** "J", "F", "M": one letter per month, for the year in pixels. */
export function formatMonthNarrow(value: DateString): string {
  return capitalized(format(parseDateString(value), 'LLLLL', { locale: locale() }));
}
