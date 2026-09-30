import type { DateString } from '@/lib/dates';

import { lookbackDays } from '../lookback';

const d = (s: string) => s as DateString;

describe('lookback', () => {
  it('looks back a week, a month, six months and a year', () => {
    expect(lookbackDays(d('2026-09-26'))).toEqual([
      { key: 'week', date: '2026-09-19' },
      { key: 'month', date: '2026-08-26' },
      { key: 'halfYear', date: '2026-03-26' },
      { key: 'year', date: '2025-09-26' },
    ]);
  });

  it('clamps to the end of a shorter month', () => {
    expect(lookbackDays(d('2026-03-31')).map((day) => day.date)).toEqual(['2026-03-24', '2026-02-28', '2025-09-30', '2025-03-31']);
    expect(lookbackDays(d('2028-02-29')).at(-1)?.date).toBe('2027-02-28');
  });
});
