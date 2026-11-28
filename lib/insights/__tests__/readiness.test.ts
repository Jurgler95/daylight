import { addDaysToDateString, type DateString } from '@/lib/dates';

import type { EntryFacts } from '../days';
import { buildInsights } from '../overview';
import { INSIGHT_MINIMUMS, insightReadiness } from '../readiness';

const today = '2026-11-27' as DateString;

/** One entry on each of the last `count` days, or on the days given. */
function entriesOn(dates: readonly string[]): EntryFacts[] {
  return dates.map((date) => ({ date, time: '20:00', level: 4, activity_ids: [] }));
}
const lastDays = (count: number, end: DateString = today) => Array.from({ length: count }, (_, i) => addDaysToDateString(end, -i));
const readiness = (entries: EntryFacts[], range: '30' | '90' | '365' | 'all' = '90') =>
  insightReadiness(buildInsights({ entries, range, today, firstDayOfWeek: 1 }));

describe('insightReadiness', () => {
  it('counts the days still missing before the cards show, not the entries', () => {
    expect(readiness(entriesOn([today]))).toMatchObject({ diaryDays: 1, missing: 6 });
    // Three entries on one day are still one day.
    expect(readiness(entriesOn([today, today, today]))).toMatchObject({ diaryDays: 1, missing: 6 });
    expect(readiness(entriesOn(lastDays(6)))).toMatchObject({ diaryDays: 6, missing: 1 });
    expect(readiness(entriesOn(lastDays(INSIGHT_MINIMUMS.diaryDays)))).toMatchObject({ diaryDays: 7, missing: 0 });
    expect(readiness(entriesOn(lastDays(40)))).toMatchObject({ diaryDays: 7, missing: 0 });
  });

  it('shows the weekdays from two weeks spread over five weekdays on', () => {
    expect(readiness(entriesOn(lastDays(13))).weekdays).toBe(false);
    expect(readiness(entriesOn(lastDays(14))).weekdays).toBe(true);
    // Fourteen days, but only on two weekdays (every Monday and Tuesday for seven weeks).
    const mondaysAndTuesdays = Array.from({ length: 7 }, (_, week) => addDaysToDateString('2026-11-23' as DateString, -7 * week)).flatMap((monday) => [
      monday,
      addDaysToDateString(monday, 1),
    ]);
    expect(readiness(entriesOn(mondaysAndTuesdays)).weekdays).toBe(false);
  });

  it('shows the months once two of them in the range have entries', () => {
    expect(readiness(entriesOn(['2026-11-02', '2026-11-03', '2026-11-04'])).months).toBe(false);
    expect(readiness(entriesOn(['2026-10-30', '2026-11-02'])).months).toBe(true);
  });

  it('judges the overview by the range picked', () => {
    // A long diary with nothing in the last 30 days but two days.
    const old = lastDays(20, '2026-09-01' as DateString);
    const entries = entriesOn([...old, today, addDaysToDateString(today, -1)]);
    expect(readiness(entries, '30')).toMatchObject({ missing: 0, overview: false });
    expect(readiness(entries, 'all')).toMatchObject({ missing: 0, overview: true });
  });
});
