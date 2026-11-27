import { addDaysToDateString, type DateString } from '@/lib/dates';
import { buildDays, type EntryFacts, type InsightDay } from '@/lib/insights';

import { goodLevel, goodTomorrow, MAX_IN_WINDOW, MIN_PAIRS, resetTomorrowCache, tomorrowBacktest, WINDOW_DAYS, withNumberSpans, type BodyByDate } from '../tomorrow';

const start = '2026-01-01' as DateString;
/** Activities 100 to 129, ticked every day, as some people do with places or weather. */
const HABITS = Array.from({ length: 30 }, (_, i) => 100 + i);

/** Park–Miller, exact in doubles, so every run sees the same "chance". */
function random(seed: number) {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

const entry = (i: number, level: number, activity_ids: number[]): EntryFacts => ({ date: addDaysToDateString(start, i), time: '20:00', level, activity_ids });

/** Activity 7 on every third day, and the day after it is always good; other days are mixed. */
function signal(length: number, habits: number[] = []): EntryFacts[] {
  return Array.from({ length }, (_, i) => entry(i, i % 3 === 1 ? 4 : [2, 3, 4, 2][i % 4]!, [...(i % 3 === 0 ? [7] : []), ...habits]));
}

/** Levels and an activity drawn independently of the day before; `good` is the share of level-4 days. */
function noise(length: number, seed: number, good: number, habits: number[] = []): EntryFacts[] {
  const next = random(seed);
  return Array.from({ length }, (_, i) => entry(i, next() < good ? 4 : 3, [...(next() < 0.5 ? [7] : []), ...habits]));
}

/**
 * Plays the last `span` calendar days one by one, as the app would: a hint counts as shown only on
 * days with an entry and, when `opened` is given, only on days the app was opened.
 */
function play(days: readonly InsightDay[], span: number, opened: (date: string) => boolean = () => true, body?: BodyByDate): string[] {
  const shown: string[] = [];
  const last = days[days.length - 1]!.date;
  for (let n = span - 1; n >= 0; n -= 1) {
    const today = addDaysToDateString(last, -n);
    const upTo = days.filter((d) => d.date <= today);
    if (opened(today) && goodTomorrow({ days: upTo, scales: [], today, shown, body }).hint) shown.push(today);
  }
  return shown;
}

/** Hints in every window of `WINDOW_DAYS` consecutive calendar days of the last `span`. */
function perWindow(days: readonly InsightDay[], span: number, shown: readonly string[]): number[] {
  const last = days[days.length - 1]!.date;
  const counts: number[] = [];
  for (let n = span - WINDOW_DAYS; n >= 0; n -= 1) {
    const end = addDaysToDateString(last, -n);
    const from = addDaysToDateString(end, 1 - WINDOW_DAYS);
    counts.push(shown.filter((date) => date >= from && date <= end).length);
  }
  return counts;
}

describe('goodTomorrow', () => {
  const days = buildDays(signal(150));
  const lastWith7 = days.filter((day) => day.activities.has(7)).pop()!.date;
  const lastWithout = days.filter((day) => !day.activities.has(7)).pop()!.date;
  const upTo = (date: DateString) => days.filter((day) => day.date <= date);

  it('speaks up after a day with the activity, names it, and has the backtest behind it', () => {
    // A third of the days carry the activity, more than the top step lets through; after a quiet
    // stretch any of them qualifies.
    const { hint } = goodTomorrow({ days: upTo(lastWith7), scales: [], today: lastWith7, shown: [addDaysToDateString(lastWith7, -10)] });
    expect(hint).toMatchObject({ date: addDaysToDateString(lastWith7, 1), level: 4 });
    expect(hint!.proof!.hitRate).toBeGreaterThan(hint!.proof!.usual + 0.2);
    expect(hint!.reasons).toContainEqual({ kind: 'activity', activityId: 7 });
  });

  it('stays silent by rank on another day shortly after a hint', () => {
    const { hint } = goodTomorrow({ days: upTo(lastWithout), scales: [], today: lastWithout, shown: [addDaysToDateString(lastWithout, -2)] });
    expect(hint).toBeNull();
  });

  it('stays silent without an entry today, and after four hints in two weeks', () => {
    expect(goodTomorrow({ days: upTo(lastWith7), scales: [], today: addDaysToDateString(lastWith7, 1), shown: [] }).hint).toBeNull();
    const four = [1, 3, 5, 7].map((n) => addDaysToDateString(lastWith7, -n));
    expect(goodTomorrow({ days: upTo(lastWith7), scales: [], today: lastWith7, shown: four }).hint).toBeNull();
    expect(MAX_IN_WINDOW).toBe(4);
  });

  it('counts today’s own hint on the outlook page, but not against today', () => {
    const result = goodTomorrow({ days: upTo(lastWith7), scales: [], today: lastWith7, shown: [lastWith7] });
    expect(result.status).toMatchObject({ kind: 'ready', shown: 1 });
    expect(result.hint).not.toBeNull();
  });

  it('fits each backtest block only on the days before it, and the cache changes nothing', () => {
    resetTomorrowCache();
    const full = tomorrowBacktest(days, []);
    resetTomorrowCache();
    const early = tomorrowBacktest(days.slice(0, 100), []);
    const whole = early.length - (early.length % 7);
    expect(full.slice(0, whole)).toEqual(early.slice(0, whole));
    expect(tomorrowBacktest(days, [])).toEqual(full);
  });

  it('names how many days it needs, and how many there are', () => {
    const short = buildDays(signal(20));
    expect(goodTomorrow({ days: short, scales: [], today: short[short.length - 1]!.date, shown: [] }).status).toEqual({ kind: 'tooFew', pairs: 19, needed: MIN_PAIRS });
  });

  it('measures a good day against the user’s own mean, never below the middle', () => {
    expect(goodLevel([{ mean: 4 }, { mean: 4 }, { mean: 3.88 }])).toBe(4);
    expect(goodLevel([{ mean: 3 }, { mean: 3 }, { mean: 4 }])).toBe(4);
    expect(goodLevel([{ mean: 3 }, { mean: 3 }])).toBe(3);
    expect(goodLevel([{ mean: 2 }, { mean: 3 }])).toBe(3);
  });

  it('says so when every day is already good', () => {
    const same = buildDays(Array.from({ length: 60 }, (_, i) => entry(i, 4, [])));
    expect(goodTomorrow({ days: same, scales: [], today: same[same.length - 1]!.date, shown: [] })).toEqual({ status: { kind: 'alwaysGood', level: 4 }, hint: null });
  });

  it.each([
    ['85 % good', 0.85, []],
    ['50 % good', 0.5, []],
    ['30 % good', 0.3, []],
    ['30 % good, thirty daily habits', 0.3, HABITS],
  ])('comes one to four times in every two weeks on a diary of chance (%s)', (_, good, habits) => {
    const diary = buildDays(noise(220, 11, good, habits));
    const counts = perWindow(diary, 84, play(diary, 84));
    expect(Math.max(...counts)).toBeLessThanOrEqual(MAX_IN_WINDOW);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
  });

  it('never exceeds four with gaps in the diary and days the app stays closed', () => {
    const next = random(3);
    const diary = buildDays(noise(220, 17, 0.6).filter(() => next() < 0.8));
    const openNext = random(23);
    const counts = perWindow(diary, 84, play(diary, 84, () => openNext() < 0.7));
    expect(Math.max(...counts)).toBeLessThanOrEqual(MAX_IN_WINDOW);
    expect(counts.reduce((sum, n) => sum + n, 0) / counts.length).toBeGreaterThanOrEqual(1);
  });

  it('steps down to "above usual" after quiet days, and only claims a top rank at the top step', () => {
    const diary = buildDays(noise(220, 11, 0.5));
    const long = addDaysToDateString(diary[diary.length - 1]!.date, -60);
    const hints = diary.slice(-40).flatMap((day) => goodTomorrow({ days: diary.filter((d) => d.date <= day.date), scales: [], today: day.date, shown: [long] }).hint ?? []);
    expect(hints.some((hint) => hint.tier === 'above')).toBe(true);
  });

  it('names a long night as the reason when the days after long nights are good', () => {
    const next = random(5);
    const nights = Array.from({ length: 160 }, () => (next() < 0.4 ? 540 : 360));
    const diary = buildDays(Array.from({ length: 160 }, (_, i) => entry(i, i > 0 && nights[i - 1] === 540 ? 4 : next() < 0.3 ? 4 : 3, [])));
    const body: BodyByDate = new Map(diary.map((day, i) => [day.date, { sleep: nights[i]!, steps: null }]));
    const longNight = diary.filter((_, i) => nights[i] === 540).pop()!.date;
    const { hint } = goodTomorrow({ days: diary.filter((day) => day.date <= longNight), scales: [], today: longNight, shown: [], body });
    expect(hint?.reasons).toContainEqual({ kind: 'sleep', minutes: 540 });
  });
});

describe('withNumberSpans', () => {
  const weight = { id: 3, name: 'Gewicht', min: 0, max: 0, kind: 'number' as const, unit: 'kg', decimals: 1 };
  const energy = { id: 1, name: 'Energie', min: 1, max: 5, kind: 'rating' as const };

  it('gives a number scale the 10th to 90th percentile of its day values, other scales stay', () => {
    const facts: EntryFacts[] = Array.from({ length: 10 }, (_, i) => ({
      date: addDaysToDateString('2026-01-01' as DateString, i),
      time: '07:00',
      level: 3,
      activity_ids: [],
      scales: [{ scale_id: 3, value: 70 + i }],
    }));
    const [spanned, rating] = withNumberSpans([weight, energy], buildDays(facts));
    expect(spanned).toMatchObject({ min: 71, max: 79 });
    expect(rating).toBe(energy);
  });

  it('keeps a range for equal values, so no feature divides by zero', () => {
    const facts: EntryFacts[] = [{ date: '2026-01-01', time: '07:00', level: 3, activity_ids: [], scales: [{ scale_id: 3, value: 72 }] }];
    expect(withNumberSpans([weight], buildDays(facts))[0]).toMatchObject({ min: 72, max: 72.1 });
  });
});
