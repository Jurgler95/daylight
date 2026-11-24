import type { HealthDay } from '@/db/schema';
import { addDaysToDateString } from '@/lib/dates';

import { buildDays, type EntryFacts } from '../days';
import { buildTrends, MOOD_MIN_CHANGE, seriesTrend, type TrendPoint } from '../trends';
import { d } from './fixtures';

const today = d('2026-11-23');

/** One value per day, `weeks` given newest first, seven equal days each, ending today. */
function weekly(weeks: number[]): TrendPoint[] {
  return weeks.flatMap((value, week) => Array.from({ length: 7 }, (_, i) => ({ date: addDaysToDateString(today, -7 * week - i), value })));
}

describe('seriesTrend', () => {
  it('finds a run of weekly means and where it began', () => {
    const { run } = seriesTrend(weekly([4.3, 4.1, 3.9, 3.7, 4.5, 4.5]), today, MOOD_MIN_CHANGE);
    expect(run).toMatchObject({ direction: 'up', weeks: 3, since: d('2026-10-27') });
    expect(run!.from).toBeCloseTo(3.7);
    expect(run!.to).toBeCloseTo(4.3);
  });

  it('keeps going through equal weeks and stops at the first week the other way', () => {
    const { run } = seriesTrend(weekly([3, 3.4, 3.4, 3.8, 3.6]), today, MOOD_MIN_CHANGE);
    expect(run).toMatchObject({ direction: 'down', weeks: 3 });
    expect(run!.from).toBeCloseTo(3.8);
  });

  it('ignores runs that are too short or too small', () => {
    expect(seriesTrend(weekly([4.3, 4.1, 3.9, 4.5]), today, MOOD_MIN_CHANGE).run).toBeNull();
    expect(seriesTrend(weekly([4.0, 3.95, 3.9, 3.85, 3.8]), today, MOOD_MIN_CHANGE).run).toBeNull();
  });

  it('does not count a day-to-day zigzag as a trend', () => {
    const points = Array.from({ length: 70 }, (_, i) => ({ date: addDaysToDateString(today, -i), value: i % 2 ? 3 : 5 }));
    expect(seriesTrend(points, today, MOOD_MIN_CHANGE)).toEqual({ run: null, shift: null });
  });

  it('needs four days in a week; a thin week ends the run', () => {
    const points = weekly([4.3, 4.1, 3.9, 3.7]).filter((point) => point.date > addDaysToDateString(today, -14) || point.date < addDaysToDateString(today, -18));
    expect(seriesTrend(points, today, MOOD_MIN_CHANGE).run).toBeNull();
  });

  it('compares the last four weeks with the quarter before', () => {
    const { shift } = seriesTrend(weekly([3.5, 3.5, 3.5, 3.5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]), today, MOOD_MIN_CHANGE);
    expect(shift).toEqual({ direction: 'down', recent: 3.5, before: 4 });
  });

  it('leaves the comparison out without enough values before', () => {
    expect(seriesTrend(weekly([3.5, 3.5, 3.5, 3.5, 4, 4, 4, 4, 4]), today, MOOD_MIN_CHANGE).shift).toBeNull();
  });
});

describe('buildTrends', () => {
  const levels = [5, 4, 4, 3];
  const entries: EntryFacts[] = weekly(levels).map((point) => ({ date: point.date, time: '20:00', level: point.value, activity_ids: [] }));
  const steps = weekly([6000, 5500, 5000, 4000]);
  const health: HealthDay[] = steps.map((point) => ({
    date: point.date,
    steps: point.value,
    sleep_minutes: null,
    resting_hr: null,
    exercise_minutes: null,
    synced_at: '',
    restored: false,
  }));

  it('names mood and health values with a run, and a turning point near its start', () => {
    const trends = buildTrends({
      allDays: buildDays(entries),
      scales: [],
      health,
      turningPoints: [{ date: '2026-11-01', title: 'Umzug' }],
      today,
    });
    expect(trends.map((trend) => trend.subject)).toEqual([{ kind: 'mood' }, { kind: 'health', metric: 'steps' }]);
    expect(trends[0]!.turningPoint).toEqual({ date: '2026-11-01', title: 'Umzug' });
  });

  it("leaves today's steps out, they may still grow", () => {
    const short = health.map((row) => (row.date === today ? { ...row, steps: 100 } : row));
    const [, stepsTrend] = buildTrends({ allDays: buildDays(entries), scales: [], health: short, turningPoints: [], today });
    expect(stepsTrend!.run!.to).toBe(6000);
  });
});
