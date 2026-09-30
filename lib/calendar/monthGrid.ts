import { addMonthsToDateString, monthWeekDays, startOfMonthString, type DateString } from '@/lib/dates';

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface DayCell {
  date: DateString;
  inMonth: boolean;
  dayOfMonth: number;
}

export function firstOfMonth(date: DateString): DateString {
  return startOfMonthString(date);
}

export function shiftMonth(month: DateString, delta: number): DateString {
  return addMonthsToDateString(month, delta);
}

/** Always returns complete weeks so the grid has 4 to 6 rows of 7. */
export function buildMonthGrid(month: DateString, weekStartsOn: WeekStart): DayCell[][] {
  const prefix = month.slice(0, 7);
  const weeks: DayCell[][] = [];
  monthWeekDays(month, weekStartsOn).forEach((date, index) => {
    const cell: DayCell = { date, inMonth: date.startsWith(prefix), dayOfMonth: Number(date.slice(8, 10)) };
    if (index % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1]?.push(cell);
  });
  return weeks;
}

/** Every month start from `from` to `to`, inclusive, oldest first. */
export function monthsBetween(from: DateString, to: DateString): DateString[] {
  const months: DateString[] = [];
  for (let month = firstOfMonth(from); month <= firstOfMonth(to); month = shiftMonth(month, 1)) months.push(month);
  return months;
}
