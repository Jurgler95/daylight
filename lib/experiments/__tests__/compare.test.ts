import type { HealthDay } from '@/db/schema';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import { buildDays, type EntryFacts } from '@/lib/insights';
import type { ScaleFacts } from '@/lib/insights/scales';

import { checkInCounts, compareExperiment, type ExperimentFacts } from '../compare';

const d = (value: string) => value as DateString;

/** One entry a day from `from` for `count` days. */
function diary(from: DateString, count: number, pick: (date: DateString) => { level: number; activities?: number[]; energy?: number }): EntryFacts[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDaysToDateString(from, i);
    const { level, activities = [], energy } = pick(date);
    return { date, time: '20:00', level, activity_ids: activities, scales: energy === undefined ? [] : [{ scale_id: 1, value: energy }] };
  });
}

const energy: ScaleFacts = { id: 1, name: 'Energie', min: 1, max: 5, kind: 'rating' };
const experiment: ExperimentFacts = { id: 1, title: 'Kein Kaffee', start_date: '2026-06-01', end_date: '2026-06-28' };

/** Wavy around 3 for over a year, 4.5 and "walk" in the experiment. */
const days = buildDays(
  diary(d('2025-01-01'), 600, (date) => {
    const inside = date >= experiment.start_date && date <= experiment.end_date;
    const wave = (Number(date.slice(8, 10)) % 5) / 4 - 0.5;
    return inside ? { level: 4.5 + wave / 2, activities: [2], energy: 4 } : { level: 3 + wave, activities: [1], energy: 2 + (Number(date.slice(8, 10)) % 2) };
  }),
);
const input = { experiment, experiments: [experiment], days, health: [] as HealthDay[], scales: [energy] };

describe('compareExperiment', () => {
  it('compares the experiment with as many days right before it, and judges once it is over', () => {
    const result = compareExperiment({ ...input, today: d('2026-09-01') });
    expect(result).toMatchObject({ state: 'over', total: 28, elapsed: 28, tooShort: false, enough: true, beforeDays: 28, duringDays: 28 });
    expect(result.before).toEqual({ from: d('2026-05-04'), to: d('2026-05-31') });
    expect(result.during).toEqual({ from: d('2026-06-01'), to: d('2026-06-28') });
    expect(result.mood!.during - result.mood!.before).toBeGreaterThan(1);
    expect(result.mood!.verdict).toMatchObject({ kind: 'larger', preliminary: false });
    expect(result.scales).toEqual([expect.objectContaining({ scaleId: 1, during: 4, verdict: expect.objectContaining({ kind: 'larger' }) })]);
    expect(result.judged).toBe(2);
    expect(result.activities.map((row) => [row.activityId, row.beforeShare, row.afterShare])).toEqual([
      [1, 1, 0],
      [2, 0, 1],
    ]);
    // Four weeks: no hint about the seasons even though May and June differ.
    expect(result.seasons).toBe(false);
  });

  it('shows the interim numbers without a verdict while it runs', () => {
    const result = compareExperiment({ ...input, today: d('2026-06-10') });
    expect(result).toMatchObject({ state: 'running', elapsed: 10, enough: true, duringDays: 10 });
    expect(result.during).toEqual({ from: d('2026-06-01'), to: d('2026-06-10') });
    expect(result.mood!.verdict).toBeNull();
    expect(result.scales[0]!.verdict).toBeNull();
    expect(result.judged).toBe(0);
  });

  it('says nothing with too few days, and nothing at all while planned', () => {
    const early = compareExperiment({ ...input, today: d('2026-06-05') });
    expect(early).toMatchObject({ enough: false, mood: null, scales: [], activities: [], duringDays: 5 });
    const planned = compareExperiment({ ...input, today: d('2026-05-01') });
    expect(planned).toMatchObject({ state: 'planned', elapsed: 0, during: null, enough: false });
  });

  it('has no comparison after an end within the first week', () => {
    const short = { ...experiment, end_date: '2026-06-05' };
    const result = compareExperiment({ ...input, experiment: short, experiments: [short], today: d('2026-09-01') });
    expect(result).toMatchObject({ tooShort: true, total: 5, enough: false, mood: null });
    expect(result.before).toEqual({ from: d('2026-05-27'), to: d('2026-05-31') });
  });

  it('shortens "Davor" to the start of the diary', () => {
    const young = buildDays(diary(d('2026-05-20'), 60, () => ({ level: 3 })));
    const result = compareExperiment({ ...input, days: young, today: d('2026-09-01') });
    expect(result.before).toEqual({ from: d('2026-05-20'), to: d('2026-05-31') });
    expect(result).toMatchObject({ beforeDays: 12, enough: true });
    expect(result.mood!.verdict).toEqual({ kind: 'unjudgeable' });
    expect(result.judged).toBe(0);
  });

  it('names other experiments in the span and in "Davor"', () => {
    const others: ExperimentFacts[] = [
      experiment,
      { id: 2, title: 'Abendspaziergang', start_date: '2026-06-20', end_date: '2026-07-20' },
      { id: 3, title: 'Früher schlafen', start_date: '2026-05-01', end_date: '2026-05-10' },
      { id: 4, title: 'Viel früher', start_date: '2026-01-01', end_date: '2026-01-28' },
    ];
    const result = compareExperiment({ ...input, experiments: others, today: d('2026-09-01') });
    expect(result.overlapDuring.map((row) => row.id)).toEqual([2]);
    expect(result.overlapBefore.map((row) => row.id)).toEqual([3]);
    // While it runs, only what overlapped the days so far: "Abendspaziergang" has not begun on 10 June.
    const running = compareExperiment({ ...input, experiments: others, today: d('2026-06-10') });
    expect(running.overlapDuring).toEqual([]);
    expect(compareExperiment({ ...input, experiments: others, today: d('2026-06-20') }).overlapDuring.map((row) => row.id)).toEqual([2]);
  });

  it('hints at the seasons only from six weeks on', () => {
    const long = { ...experiment, start_date: '2026-03-15', end_date: '2026-05-09' };
    expect(compareExperiment({ ...input, experiment: long, experiments: [long], today: d('2026-09-01') }).seasons).toBe(true);
    const sameSeason = { ...experiment, start_date: '2026-07-01', end_date: '2026-08-11' };
    expect(compareExperiment({ ...input, experiment: sameSeason, experiments: [sameSeason], today: d('2026-09-01') }).seasons).toBe(false);
  });

  it('hints at a return to the usual when "Davor" lay well below the mean before it', () => {
    const dip = buildDays(diary(d('2026-01-01'), 200, (date) => ({ level: date >= '2026-05-04' && date < '2026-06-01' ? 2 : 3.5 })));
    expect(compareExperiment({ ...input, days: dip, today: d('2026-09-01') }).regression).toBe(true);
    const flat = buildDays(diary(d('2026-01-01'), 200, () => ({ level: 3 })));
    expect(compareExperiment({ ...input, days: flat, today: d('2026-09-01') }).regression).toBe(false);
    // A further fall in the experiment is no return to the usual.
    const fall = buildDays(diary(d('2026-01-01'), 200, (date) => ({ level: date >= '2026-06-01' ? 1.5 : date >= '2026-05-04' ? 2 : 3.5 })));
    expect(compareExperiment({ ...input, days: fall, today: d('2026-09-01') }).regression).toBe(false);
  });

  it('compares and judges health values with enough days on both sides', () => {
    const health: HealthDay[] = Array.from({ length: 560 }, (_, i) => {
      const date = addDaysToDateString(d('2025-01-01'), i);
      const inside = date >= experiment.start_date && date <= experiment.end_date;
      return { date, steps: inside ? 12000 : 6000 + (i % 7) * 100, sleep_minutes: null, resting_hr: null, exercise_minutes: null, synced_at: 'x', restored: false };
    });
    const result = compareExperiment({ ...input, health, today: d('2026-09-01') });
    expect(result.health.map((row) => row.metric)).toEqual(['steps', 'exercise']);
    expect(result.health[0]).toMatchObject({ after: 12000, verdict: expect.objectContaining({ kind: 'larger' }) });
    expect(result.judged).toBe(4);
  });
});

describe('checkInCounts', () => {
  it('counts the answers and finds the "no" that ended it', () => {
    const ended = { start_date: '2026-06-01', end_date: '2026-06-09' };
    expect(
      checkInCounts(ended, [
        { date: '2026-06-01', kept: true },
        { date: '2026-06-05', kept: true },
        { date: '2026-06-10', kept: false },
      ]),
    ).toEqual({ answered: 3, kept: 2, endedByNo: '2026-06-10' });
    expect(checkInCounts({ start_date: '2026-06-01', end_date: '2026-06-01' }, [{ date: '2026-06-01', kept: false }]).endedByNo).toBe('2026-06-01');
    expect(checkInCounts(experiment, [{ date: '2026-06-02', kept: true }])).toEqual({ answered: 1, kept: 1, endedByNo: null });
    expect(checkInCounts(experiment, [])).toEqual({ answered: 0, kept: 0, endedByNo: null });
  });
});
