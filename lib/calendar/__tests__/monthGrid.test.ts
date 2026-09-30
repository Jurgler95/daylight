import { weekdayLabels, type DateString } from '@/lib/dates';

import { buildMonthGrid, firstOfMonth, monthsBetween, shiftMonth } from '../monthGrid';

const d = (s: string) => s as DateString;

describe('monthGrid', () => {
  it('builds full weeks starting Monday', () => {
    const weeks = buildMonthGrid(d('2026-09-01'), 1);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]?.[0]?.date).toBe('2026-08-31');
    expect(weeks[0]?.[0]?.inMonth).toBe(false);
    expect(weeks[0]?.[1]?.date).toBe('2026-09-01');
    expect(weeks[4]?.[6]?.date).toBe('2026-10-04');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]?.[1]).toMatchObject({ inMonth: true, dayOfMonth: 1 });
    expect(weeks[4]?.[6]).toMatchObject({ inMonth: false, dayOfMonth: 4 });
    expect(weeks.flat().filter((cell) => cell.inMonth)).toHaveLength(30);
    expect(buildMonthGrid(d('2026-09-14'), 1)).toEqual(weeks);
  });

  it('respects Sunday start and February', () => {
    const weeks = buildMonthGrid(d('2026-02-01'), 0);
    expect(weeks[0]?.[0]?.date).toBe('2026-02-01');
    expect(weeks).toHaveLength(4);
  });

  it('shifts months across year boundaries', () => {
    expect(shiftMonth(d('2026-12-01'), 1)).toBe('2027-01-01');
    expect(shiftMonth(d('2026-01-01'), -1)).toBe('2025-12-01');
    expect(firstOfMonth(d('2026-09-14'))).toBe('2026-09-01');
  });

  it('labels weekdays in German', () => {
    expect(weekdayLabels(1)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
    expect(weekdayLabels(0)[0]).toBe('So');
  });
});

describe('monthsBetween', () => {
  it('lists every month start inclusively', () => {
    expect(monthsBetween(d('2026-09-14'), d('2026-12-01'))).toEqual(['2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01']);
  });

  it('crosses years', () => {
    expect(monthsBetween(d('2025-11-20'), d('2026-02-03'))).toEqual(['2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01']);
  });

  it('returns the single month when both ends share it', () => {
    expect(monthsBetween(d('2026-09-01'), d('2026-09-30'))).toEqual(['2026-09-01']);
  });
});
