import type { HealthDay } from '@/db/schema';

import { healthMood } from '../health';
import { days, run } from './fixtures';

function health(date: string, values: Partial<HealthDay>): HealthDay {
  return { date, steps: null, sleep_minutes: null, resting_hr: null, exercise_minutes: null, synced_at: '2026-09-27T10:00:00.000Z', restored: false, ...values };
}

describe('healthMood', () => {
  const diary = days(run('2026-09-01', [2, 2, 3, 4, 5, 4, 1]));

  it('sorts diary days into bands of last night’s sleep and of steps', () => {
    const rows = [
      health('2026-09-01', { sleep_minutes: 300, steps: 2000 }),
      health('2026-09-02', { sleep_minutes: 330, steps: 3000 }),
      health('2026-09-03', { sleep_minutes: 350, steps: 4000 }),
      health('2026-09-04', { sleep_minutes: 460, steps: 12000 }),
      health('2026-09-05', { sleep_minutes: 470, steps: 11000 }),
      health('2026-09-06', { sleep_minutes: 450, steps: 10000 }),
      // A day without an entry does not count.
      health('2026-09-20', { sleep_minutes: 200, steps: 100 }),
    ];
    const mood = healthMood(diary, rows);
    expect(mood.pairedDays).toBe(6);
    expect(mood.sleep.map((b) => [b.key, b.mean, b.days])).toEqual([
      ['sleepUnder6', 7 / 3, 3],
      ['sleep6to7', null, 0],
      ['sleep7to8', 13 / 3, 3],
      ['sleepOver8', null, 0],
    ]);
    expect(mood.steps.map((b) => [b.key, b.days])).toEqual([
      ['stepsUnder5k', 3],
      ['steps5to10k', 0],
      ['stepsOver10k', 3],
    ]);
    expect(mood.exercise).toEqual([]);
  });

  it('shows no mean below three days and compares days with and without exercise', () => {
    const rows = [
      health('2026-09-01', { exercise_minutes: 30 }),
      health('2026-09-02', { steps: 4000 }),
      health('2026-09-05', { exercise_minutes: 45 }),
    ];
    const mood = healthMood(diary, rows);
    expect(mood.exercise).toEqual([
      { key: 'exerciseWith', mean: null, days: 2 },
      { key: 'exerciseWithout', mean: null, days: 1 },
    ]);
    expect(mood.sleep).toEqual([]);
  });

  it('sorts the resting pulse around its median', () => {
    const pulses = [55, 58, 60, 60, 61, 64, 66];
    const rows = pulses.map((resting_hr, i) => health(`2026-09-0${i + 1}`, { resting_hr }));
    const mood = healthMood(diary, rows);
    expect(mood.hrBounds).toEqual([58, 62]);
    expect(mood.restingHr.map((b) => [b.key, b.days])).toEqual([
      ['hrLow', 1],
      ['hrUsual', 4],
      ['hrHigh', 2],
    ]);
  });
});
