import type { DateString } from '@/lib/dates';

import { dayMoods, roundLevel } from '../dayMood';

const d = (s: string) => s as DateString;

describe('roundLevel', () => {
  it('rounds half up and clamps to 1..5', () => {
    expect(roundLevel(3.5)).toBe(4);
    expect(roundLevel(3.49)).toBe(3);
    expect(roundLevel(2.5)).toBe(3);
    expect(roundLevel(1)).toBe(1);
    expect(roundLevel(0.2)).toBe(1);
    expect(roundLevel(7)).toBe(5);
  });
});

describe('dayMoods', () => {
  it('is empty without entries', () => {
    expect(dayMoods([]).size).toBe(0);
  });

  it('takes a single entry as it is', () => {
    expect(dayMoods([{ date: d('2026-09-01'), level: 2 }]).get(d('2026-09-01'))).toEqual({
      date: '2026-09-01',
      mean: 2,
      level: 2,
      count: 1,
    });
  });

  it('averages several entries of one day and keeps days apart', () => {
    const days = dayMoods([
      { date: d('2026-09-01'), level: 3 },
      { date: d('2026-09-02'), level: 5 },
      { date: d('2026-09-01'), level: 4 },
      { date: d('2026-09-01'), level: 4 },
    ]);
    expect(days.get(d('2026-09-01'))).toMatchObject({ mean: 11 / 3, level: 4, count: 3 });
    expect(days.get(d('2026-09-02'))).toMatchObject({ mean: 5, level: 5, count: 1 });
  });

  it('colours a day of Ok and Gut as Gut', () => {
    const days = dayMoods([
      { date: d('2026-09-01'), level: 3 },
      { date: d('2026-09-01'), level: 4 },
    ]);
    expect(days.get(d('2026-09-01'))).toMatchObject({ mean: 3.5, level: 4, count: 2 });
  });
});
