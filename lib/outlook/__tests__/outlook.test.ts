import { addDaysToDateString, weekdayOf, type DateString } from '@/lib/dates';
import { buildDays, type EntryFacts } from '@/lib/insights';
import { d, run } from '@/lib/insights/__tests__/fixtures';

import { backtest, backtestCases, backtestOrigins, HORIZONS, MIN_OUTLOOK_DAYS, mostFrequentLevel, originKeys, quantile, type BacktestResult } from '../backtest';
import { expectDay, fitModel } from '../model';
import { buildOutlook, confidenceOf } from '../outlook';
import { recurringActivities } from '../recurring';

/** 2026-01-05 is a Monday. */
const START = '2026-01-05';

/** `count` consecutive days from START; `level(i, weekday)` and `acts(i, weekday)` decide each day. */
function diary(count: number, level: (i: number, weekday: number) => number, acts: (i: number, weekday: number) => number[] = () => []): EntryFacts[] {
  const levels: number[] = [];
  const activities: number[][] = [];
  for (let i = 0; i < count; i += 1) {
    const weekday = weekdayOf(addDaysToDateString(d(START), i));
    levels.push(level(i, weekday));
    activities.push(acts(i, weekday));
  }
  return run(START, levels, activities);
}

const lastDate = (entries: EntryFacts[]) => entries[entries.length - 1]!.date as DateString;

/** A backtest in which every horizon counts as won, with the given errors, to look at the ranges alone. */
function forcedBacktest(residuals: number[]): BacktestResult {
  const sorted = [...residuals].sort((a, b) => a - b);
  return { origins: 100, horizons: HORIZONS.map((horizon) => ({ horizon, cases: sorted.length, model: 0, expected: 0, longMean: 1, mode: 1, beats: true, residuals: sorted })) };
}

describe('outlook model', () => {
  it('gives no outlook below 30 days with an entry', () => {
    const entries = diary(MIN_OUTLOOK_DAYS - 1, () => 4);
    const days = buildDays(entries);
    const result = buildOutlook({ days, today: lastDate(entries), plans: new Map(), backtest: backtest(days) });
    expect(result).toEqual({ status: 'tooFew', days: 29, needed: 30 });
    expect(backtestCases(days)).toEqual([]);
  });

  it('keeps a constant mood flat with a narrow spread', () => {
    const entries = diary(70, () => 4);
    const days = buildDays(entries);
    const today = lastDate(entries);
    const model = fitModel(days, today)!;
    for (const horizon of HORIZONS) expect(expectDay(model, addDaysToDateString(today, horizon), null).value).toBeCloseTo(4, 10);

    // Nothing to beat: the model ties both comparisons at zero error, so the real gate shows no range.
    const real = backtest(days);
    expect(real.horizons.every((h) => h.model === 0 && h.mode === 0 && !h.beats)).toBe(true);
    const gated = buildOutlook({ days, today, plans: new Map(), backtest: real });
    expect(gated.status === 'ready' && gated.days.every((day) => day.range === null)).toBe(true);

    // With the errors of that backtest (all zero), a range would be flat and as sure as it gets.
    const forced = buildOutlook({ days, today, plans: new Map(), backtest: forcedBacktest(real.horizons[0]!.residuals) });
    if (forced.status !== 'ready') throw new Error('expected an outlook');
    for (const day of forced.days) {
      expect(day.range).toMatchObject({ expected: 4, low: 4, high: 4, mid: 4, lowLevel: 4, highLevel: 4, hardChance: null, confidence: 1 });
    }
  });

  it('recognises a pure weekday rhythm and beats both comparisons with it', () => {
    // Mondays "Schlecht", every other day "Gut", for 40 weeks.
    const entries = diary(280, (_, weekday) => (weekday === 1 ? 2 : 4));
    const days = buildDays(entries);
    const today = lastDate(entries);
    const result = backtest(days);
    expect(result.horizons.every((h) => h.beats)).toBe(true);
    for (const h of result.horizons) expect(h.model!).toBeLessThan(h.mode!);

    const outlook = buildOutlook({ days, today, plans: new Map(), backtest: result });
    if (outlook.status !== 'ready') throw new Error('expected an outlook');
    expect(outlook.shownHorizons).toEqual([...HORIZONS]);
    const monday = outlook.days.find((day) => day.weekday === 1)!;
    const others = outlook.days.filter((day) => day.weekday !== 1);
    for (const other of others) expect(monday.range!.expected).toBeLessThan(other.range!.expected - 1);
    expect(monday.range!.mid).toBeLessThanOrEqual(3);
    expect(monday.range!.reasons[0]).toMatchObject({ kind: 'weekday', weekday: 1 });
    expect(monday.range!.reasons[0]!.value).toBeLessThan(-1);
  });

  it('moves a day with a planned activity', () => {
    // Activity 7 on every third day, those days "Super", the rest "Gut".
    const entries = diary(90, (i) => (i % 3 === 0 ? 5 : 4), (i) => (i % 3 === 0 ? [7] : [1]));
    const days = buildDays(entries);
    const today = lastDate(entries);
    const model = fitModel(days, today)!;
    const target = addDaysToDateString(today, 2);
    const without = expectDay(model, target, null);
    const withPlan = expectDay(model, target, [7]);
    // One step, shrunk by 30 / (30 + 10) = 0.75, and only the part above the usual share (about 1 in 3).
    expect(withPlan.value - without.value).toBeGreaterThan(0.4);
    expect(withPlan.value - without.value).toBeLessThan(0.75);
    expect(withPlan.activities).toEqual([expect.objectContaining({ activityId: 7, source: 'planned' })]);

    const outlook = buildOutlook({ days, today, plans: new Map([[target, [7]]]), backtest: forcedBacktest([-0.2, 0, 0.2]) });
    if (outlook.status !== 'ready') throw new Error('expected an outlook');
    const day = outlook.days.find((x) => x.date === target)!;
    expect(day.planned).toEqual([7]);
    expect(day.range!.reasons.some((r) => r.kind === 'activity' && r.activityId === 7 && r.source === 'planned' && r.value > 0.4)).toBe(true);
  });

  it('lets a plan override a recurring activity', () => {
    // Activity 3 ("work") on every weekday but weekends, which are one step better.
    const entries = diary(84, (_, w) => (w === 0 || w === 6 ? 5 : 4), (_, w) => (w === 0 || w === 6 ? [] : [3]));
    const days = buildDays(entries);
    const today = lastDate(entries);
    const monday = [1, 2, 3, 4, 5, 6, 7].map((h) => addDaysToDateString(today, h)).find((x) => weekdayOf(x) === 1)!;
    expect(recurringActivities(days, today, monday)).toEqual([3]);
    const model = fitModel(days, today)!;
    const usual = expectDay(model, monday, null);
    // Usual Mondays already carry work in the weekday effect, so recurring work adds nothing.
    expect(usual.activities).toEqual([expect.objectContaining({ activityId: 3, source: 'recurring' })]);
    expect(usual.activities[0]!.value).toBeCloseTo(0, 10);
    const dayOff = expectDay(model, monday, [99]);
    expect(dayOff.activities).toEqual([expect.objectContaining({ activityId: 3, source: 'skipped' })]);
    expect(dayOff.value).toBeGreaterThan(usual.value + 0.3);
  });

  it('never looks past the cut-off in the backtest', () => {
    const base = diary(120, (i) => [4, 4, 5, 3, 4, 4, 2][i % 7]!, (i) => (i % 4 === 0 ? [1] : [2]));
    const cut = base[79]!.date;
    // Same diary up to the cut-off, something entirely different after it.
    const altered = base.map((e) => (e.date > cut ? { ...e, level: 1, activity_ids: [1, 2, 9] } : e));
    const before = (entries: EntryFacts[]) => backtestCases(buildDays(entries)).filter((c) => c.origin <= cut);
    const a = before(base);
    const b = before(altered);
    expect(a.length).toBeGreaterThan(0);
    expect(b.map(({ actual: _a, ...rest }) => rest)).toEqual(a.map(({ actual: _a, ...rest }) => rest));
    // And a model fitted on the whole diary for an earlier cut-off equals one fitted on the prefix.
    const whole = fitModel(buildDays(altered), cut as DateString)!;
    const prefix = fitModel(buildDays(altered.filter((e) => e.date <= cut)), cut as DateString)!;
    expect(whole.longMean).toBe(prefix.longMean);
    expect(whole.phi).toBe(prefix.phi);
  });
});

describe('outlook helpers', () => {
  it('takes the most frequent level, a tie going to the one nearer the mean', () => {
    expect(mostFrequentLevel(buildDays(run(START, [4, 4, 5, 3])))).toBe(4);
    expect(mostFrequentLevel(buildDays(run(START, [5, 5, 3, 3, 4])))).toBe(5);
    expect(mostFrequentLevel(buildDays(run(START, [5, 5, 2, 2, 2, 5, 1])))).toBe(2);
  });

  it('interpolates quantiles and maps the spread to a confidence', () => {
    expect(quantile([], 0.5)).toBeNull();
    expect(quantile([0, 1, 2, 3, 4], 0.2)).toBeCloseTo(0.8);
    expect(quantile([0, 10], 0.5)).toBe(5);
    expect(confidenceOf(4, 4)).toBe(1);
    expect(confidenceOf(3.5, 4.5)).toBe(0.5);
    expect(confidenceOf(1, 5)).toBe(0.3);
  });
});

describe('backtest cache keys', () => {
  it('keep every cut-off but the last week when today is added', () => {
    const entries = diary(80, (i) => [4, 4, 5, 3, 4, 4, 2][i % 7]!);
    const before = buildDays(entries.slice(0, 79));
    const after = buildDays(entries);
    const origins = backtestOrigins(before);
    const a = originKeys(before, origins);
    const b = originKeys(after, origins);
    const changed = origins.filter((_, i) => a[i] !== b[i]);
    // The new day lies at most seven days after these cut-offs (the last one is two days before it), so only they see it.
    expect(changed).toEqual(origins.filter((o) => o >= addDaysToDateString(entries[79]!.date as DateString, -7)));
    expect(changed.length).toBe(6);
  });

  it('change for every later cut-off when an old day is edited', () => {
    const entries = diary(80, (i) => [4, 4, 5, 3, 4, 4, 2][i % 7]!);
    const days = buildDays(entries);
    const edited = buildDays(entries.map((e, i) => (i === 40 ? { ...e, level: 1 } : e)));
    const origins = backtestOrigins(days);
    const a = originKeys(days, origins);
    const b = originKeys(edited, origins);
    expect(origins.filter((_, i) => a[i] !== b[i])[0]).toBe(addDaysToDateString(entries[40]!.date as DateString, -7));
  });
});
