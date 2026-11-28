import type { HealthDay } from '@/db/schema';
import { addDaysToDateString, type DateString } from '@/lib/dates';

import { buildDays, type EntryFacts } from '../days';
import { analyzeLinks, buildLinks, linkDays, linkFactorKey, linkRows, linksSignature, linksSteps, MIN_COUNT, MIN_DAYS, type LinkFinding, type LinkRows, type LinksInput } from '../links';

import { diaryEntries, diaryInput, diaryNames, factorName, loadDiary, SETS, type Diary, type DiarySet } from './diaries';

/** The group every test diary keeps its feelings in; marking it is what a fresh installation does with its own. */
const MARKED = ['Feelings'];

/**
 * A finding against the diary's truth, as the harness the method was chosen with counts it: a
 * stable finding on a real effect is true, one on a confounded or unrelated factor is false, and so
 * is any finding that names a real effect with the wrong direction. Factors that describe the mood
 * and real effects found at the other lag count neither way.
 */
function score(diary: Diary, findings: readonly LinkFinding[]): { hit: number; miss: number; stable: number } {
  const effects = new Map(diary.truth.effects.map((effect) => [`${effect.factor}/${effect.lag}`, effect]));
  const withEffect = new Set(diary.truth.effects.map((effect) => effect.factor));
  const confounded = new Set(diary.truth.confounded.map((item) => item.factor));
  const descriptive = new Set(diary.truth.descriptive);
  let hit = 0;
  let miss = 0;
  let stable = 0;
  for (const finding of findings) {
    const name = factorName(diary, finding.factor);
    const isStable = finding.level === 'stable';
    if (isStable) stable += 1;
    const effect = effects.get(`${name}/${finding.lag}`);
    if (effect) {
      const wrong = finding.direction !== effect.direction;
      hit += Number(isStable) - Number(wrong);
      miss += Number(wrong);
    } else if (!withEffect.has(name) && (confounded.has(name) || !descriptive.has(name)) && isStable) miss += 1;
  }
  return { hit, miss, stable };
}

function quality(set: DiarySet, marked: readonly string[]) {
  let hit = 0;
  let miss = 0;
  const withoutEffect: number[] = [];
  for (const name of diaryNames(set)) {
    const diary = loadDiary(set, name);
    const result = score(diary, buildLinks(diaryInput(diary, marked)).findings);
    hit += result.hit;
    miss += result.miss;
    if (diary.truth.effects.length === 0) withoutEffect.push(result.stable);
  }
  return { hit, miss, withoutEffect };
}

describe('quality on the test diaries', () => {
  // Measured with the harness before they were written down here; the same numbers the method was accepted with.
  it.each([
    ['dev', [], { hit: 32, miss: 4 }],
    ['held', [], { hit: 31, miss: 2 }],
    ['dev', MARKED, { hit: 32, miss: 5 }],
    ['held', MARKED, { hit: 32, miss: 2 }],
  ] as const)('%s with %j marked: stable findings true and false', (set, marked, expected) => {
    const result = quality(set, marked);
    expect({ hit: result.hit, miss: result.miss }).toEqual(expected);
    // The three diaries of each set in which nothing moves the mood get no stable finding at all.
    expect(result.withoutEffect).toEqual([0, 0, 0]);
  });

  it('lists the marked group apart, with the result it has among all factors', () => {
    let describing = 0;
    for (const set of SETS) {
      for (const name of diaryNames(set)) {
        const diary = loadDiary(set, name);
        const feelings = new Set(diary.activities.map((activity, i) => (activity.group === 'Feelings' ? `activity:${i + 1}` : '')));
        const plain = buildLinks(diaryInput(diary));
        const marked = buildLinks(diaryInput(diary, MARKED));
        const key = (finding: LinkFinding) => `${linkFactorKey(finding.factor)}/${finding.lag}/${finding.direction}/${finding.level}`;
        expect(marked.findings.some((finding) => feelings.has(linkFactorKey(finding.factor)))).toBe(false);
        expect(marked.describing.every((finding) => feelings.has(linkFactorKey(finding.factor)))).toBe(true);
        expect(marked.describing.map(key).sort()).toEqual(plain.findings.filter((finding) => feelings.has(linkFactorKey(finding.factor))).map(key).sort());
        describing += marked.describing.length;
      }
    }
    expect(describing).toBeGreaterThan(20);
  });

  it('runs the largest diary well within a second', () => {
    const diary = loadDiary('dev', 'agent3-diary_2.json');
    const input = diaryInput(diary, MARKED);
    const started = Date.now();
    const links = buildLinks(input);
    const elapsed = Date.now() - started;
    expect(links.days).toBe(435);
    expect(elapsed).toBeLessThan(1000);
    // In slices: it gives way after every factor, matrix row and tested column.
    let steps = 0;
    const run = linksSteps(input);
    while (!run.next().done) steps += 1;
    expect(steps).toBeGreaterThan(200);
  });
});

/** Days from `start`, one entry each unless `levels[i]` is a list; `skip` leaves days out. */
function entries(start: string, levels: (number | number[])[], fill: (i: number) => Partial<EntryFacts> = () => ({}), skip: (i: number) => boolean = () => false): EntryFacts[] {
  return levels.flatMap((level, i) => {
    if (skip(i)) return [];
    const date = addDaysToDateString(start as DateString, i);
    return [level].flat().map((one, n) => ({ date, time: `${10 + n}:00`, level: one, activity_ids: [], ...(n === 0 ? fill(i) : {}) }));
  });
}

/** Deterministic noise in 0..1. */
const noise = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const START = '2026-01-01';
const input = (list: EntryFacts[], rest: Partial<LinksInput> = {}): LinksInput => ({
  allDays: buildDays(list),
  activities: [{ id: 1, describesMood: false }],
  scales: [],
  health: [],
  today: '2026-12-31' as DateString,
  ...rest,
});
const health = (date: string, steps: number | null, sleep: number | null = null): HealthDay => ({ date, steps, sleep_minutes: sleep, resting_hr: null, exercise_minutes: null, synced_at: '', restored: false });

describe('the diary as rows', () => {
  it('goes through buildDays: several entries a day give one row with their mean, all activities and summed minutes', () => {
    const list: EntryFacts[] = [
      { date: '2026-03-01', time: '08:00', level: 2, activity_ids: [1], scales: [{ scale_id: 1, value: 2 }, { scale_id: 2, value: 30 }] },
      { date: '2026-03-01', time: '20:00', level: 5, activity_ids: [2], scales: [{ scale_id: 1, value: 5 }, { scale_id: 2, value: 45 }] },
      { date: '2026-03-02', time: '20:00', level: 4, activity_ids: [], scales: [{ scale_id: 2, value: 0 }] },
    ];
    const { rows } = linkRows({
      allDays: buildDays(list),
      activities: [
        { id: 1, describesMood: false },
        { id: 2, describesMood: true },
      ],
      scales: [
        { id: 1, name: 'Energie', min: 1, max: 5, kind: 'rating', describesMood: false },
        { id: 2, name: 'Lesen', min: 0, max: 1440, kind: 'duration', describesMood: false },
      ],
      health: [health('2026-03-01', 4000, 400), health('2026-02-27', 9000, 500)],
      today: '2026-03-03' as DateString,
    });
    expect(rows.mood).toEqual([3.5, 4]);
    expect(rows.dayNumbers).toEqual([0, 1]);
    expect(rows.factors.map((factor) => [linkFactorKey(factor.key), factor.kind, factor.values])).toEqual([
      ['activity:1', 'flag', [1, 0]],
      ['activity:2', 'flag', [1, 0]],
      // A rating averages over the entries of the day, minutes add up, and no minutes are no value.
      ['scale:1', 'value', [3.5, null]],
      ['scale:2', 'value', [75, null]],
      // The row of a day without an entry is never used.
      ['health:sleep', 'value', [400, null]],
      ['health:steps', 'value', [4000, null]],
    ]);
  });

  it('matches the diary format on a day with two entries', () => {
    const diary = loadDiary('dev', 'agent1-diary_1.json');
    const two = diary.days.findIndex((day) => day.mood.length === 2);
    expect(two).toBeGreaterThanOrEqual(0);
    const days = buildDays(diaryEntries(diary));
    expect(days).toHaveLength(diary.days.length);
    expect(days[two]).toMatchObject({ date: diary.days[two]!.date, count: 2, mean: (diary.days[two]!.mood[0]! + diary.days[two]!.mood[1]!) / 2 });
    expect([...days[two]!.activities]).toHaveLength(diary.days[two]!.activities.length);
  });

  it('looks at the last 730 calendar days up to today only', () => {
    const list = entries('2024-01-01', Array.from({ length: 1100 }, () => 4));
    const today = addDaysToDateString('2024-01-01' as DateString, 1050);
    const days = linkDays(buildDays(list), today);
    expect(days).toHaveLength(730);
    expect(days[0]!.date).toBe(addDaysToDateString(today, -729));
    expect(days[days.length - 1]!.date).toBe(today);
  });

  it("leaves today's steps out and keeps today's sleep", () => {
    const list = entries(START, [4, 4, 4]);
    const today = '2026-01-03' as DateString;
    const rows = [health('2026-01-01', 5000, 420), health('2026-01-02', 6000, 430), health('2026-01-03', 300, 440)];
    const factors = linkRows(input(list, { health: rows, today })).rows.factors;
    expect(factors.find((factor) => linkFactorKey(factor.key) === 'health:steps')!.values).toEqual([5000, 6000, null]);
    expect(factors.find((factor) => linkFactorKey(factor.key) === 'health:sleep')!.values).toEqual([420, 430, 440]);
    // Steps that grow during the day do not start a new computation either.
    const grown = rows.map((row) => (row.date === today ? { ...row, steps: 900 } : row));
    expect(linksSignature(input(list, { health: grown, today }))).toBe(linksSignature(input(list, { health: rows, today })));
    const earlier = rows.map((row) => (row.date === '2026-01-02' ? { ...row, steps: 6001 } : row));
    expect(linksSignature(input(list, { health: earlier, today }))).not.toBe(linksSignature(input(list, { health: rows, today })));
  });
});

describe('single cases', () => {
  /** Mood 4 with noise, lifted on the days `lift` names. */
  const moods = (n: number, lift: (i: number) => boolean) => Array.from({ length: n }, (_, i) => Math.min(5, Math.max(1, Math.round(3 + noise(i) * 1.2 + (lift(i) ? 1.2 : 0)))));
  const tests = (rows: LinksInput) => analyzeLinks(linkRows(rows).rows);

  it('finds an activity that lifts the same day, and nothing below 30 days', () => {
    const on = (i: number) => noise(i + 500) < 0.35;
    const list = entries(START, moods(120, on), (i) => ({ activity_ids: on(i) ? [1] : [] }));
    const links = buildLinks(input(list));
    expect(links.days).toBe(120);
    expect(links.findings).toContainEqual({ factor: { kind: 'activity', id: 1 }, lag: 0, direction: 'up', level: 'stable', days: list.filter((entry) => entry.activity_ids.length).length });

    const short = buildLinks(input(list.slice(0, MIN_DAYS - 1)));
    expect(short).toEqual({ days: MIN_DAYS - 1, findings: [], describing: [] });
    expect(tests(input(list.slice(0, MIN_DAYS - 1)))).toEqual([]);
    expect(tests(input(list.slice(0, MIN_DAYS))).length).toBeGreaterThan(0);
  });

  it('takes the day after only from the calendar day before, never across a gap', () => {
    // The activity lifts the day after it.
    const on = (i: number) => i % 3 === 0;
    const levels = moods(150, (i) => on(i - 1));
    const fill = (i: number) => ({ activity_ids: on(i) ? [1] : [] });
    expect(buildLinks(input(entries(START, levels, fill))).findings).toContainEqual(expect.objectContaining({ lag: 1, direction: 'up', level: 'stable' }));

    // Without the days after it, the lifted days are gone and the day two days later must not stand in.
    const gaps = entries(START, levels, fill, (i) => on(i - 1));
    expect(buildLinks(input(gaps)).findings.filter((finding) => finding.lag === 1)).toEqual([]);

    // Every second day only: no two rows are calendar neighbours, so the day after is not tested at all.
    const lifted = moods(150, (i) => i % 4 === 2);
    const alternate = entries(START, lifted, (i) => ({ activity_ids: i % 4 === 0 ? [1] : [] }), (i) => i % 2 === 1);
    expect(tests(input(alternate)).map((test) => test.lag)).toEqual([0]);
  });

  it('needs an activity on MIN_COUNT days, and as many days without it', () => {
    const levels = moods(60, () => false);
    const withDays = (count: number) => entries(START, levels, (i) => ({ activity_ids: i % 7 === 0 && i / 7 < count ? [1] : [] }));
    expect(tests(input(withDays(MIN_COUNT - 1)))).toEqual([]);
    expect(tests(input(withDays(MIN_COUNT))).map((test) => [test.lag, test.count])).toEqual([
      [0, MIN_COUNT],
      [1, MIN_COUNT],
    ]);
    // Almost every day: the days without it are too few.
    const almost = entries(START, levels, (i) => ({ activity_ids: i % 8 === 0 && i / 8 < MIN_COUNT - 1 ? [] : [1] }));
    expect(tests(input(almost))).toEqual([]);
  });

  it('skips a scale that never changes and one with too few values, and takes missing values as usual days', () => {
    const scale = { id: 1, name: 'Energie', min: 1, max: 5, kind: 'rating' as const, describesMood: false };
    const levels = moods(90, () => false);
    const withScale = (value: (i: number) => number | null) =>
      input(entries(START, levels, (i) => (value(i) === null ? {} : { scales: [{ scale_id: 1, value: value(i)! }] })), { activities: [], scales: [scale] });
    expect(tests(withScale(() => 3))).toEqual([]);
    expect(tests(withScale((i) => (i < 19 ? 1 + (i % 5) : null)))).toEqual([]);
    // Every second day without a value: the scale is still tested, on the days that have one.
    const half = tests(withScale((i) => (i % 2 ? null : levels[i]!)));
    expect(half.map((test) => [test.lag, test.count])).toEqual([
      [0, 45],
      [1, 45],
    ]);
    expect(half[0]).toMatchObject({ direction: 'up', level: 'stable' });
    expect(Number.isFinite(half[0]!.t) && Number.isFinite(half[0]!.q)).toBe(true);
  });

  it('reads a duration as minutes of the day and no minutes as no value', () => {
    const scale = { id: 1, name: 'Sport', min: 0, max: 1440, kind: 'duration' as const, describesMood: false };
    const minutes = (i: number) => (i % 4 === 0 ? 0 : 20 + Math.round(noise(i + 9) * 60));
    const levels = Array.from({ length: 100 }, (_, i) => Math.min(5, Math.max(1, Math.round(2.5 + noise(i) + minutes(i) / 40))));
    const list = entries(START, levels, (i) => ({ scales: [{ scale_id: 1, value: minutes(i) }] }));
    const rows = input(list, { activities: [], scales: [scale] });
    const values = linkRows(rows).rows.factors[0]!.values;
    expect(values.filter((value) => value === null)).toHaveLength(25);
    expect(values[1]).toBe(minutes(1));
    expect(buildLinks(rows).findings).toContainEqual({ factor: { kind: 'scale', id: 1 }, lag: 0, direction: 'up', level: 'stable', days: 75 });
  });

  it('says nothing when every day has the same mood', () => {
    const on = (i: number) => i % 3 === 0;
    const list = entries(START, Array.from({ length: 80 }, () => 4), (i) => ({ activity_ids: on(i) ? [1] : [] }));
    expect(tests(input(list))).toEqual([]);
    expect(buildLinks(input(list))).toEqual({ days: 80, findings: [], describing: [] });
  });

  it('is the same whichever weekday the day numbers start on', () => {
    const on = (i: number) => noise(i + 500) < 0.35;
    const levels = moods(120, on);
    const rows = (offset: number): LinkRows<string> => ({ dayNumbers: levels.map((_, i) => i + offset), mood: levels, factors: [{ key: 'a', kind: 'flag', values: levels.map((_, i) => (on(i) ? 1 : 0)) }] });
    const base = analyzeLinks(rows(0));
    for (const offset of [-20_000, 7, 70_003]) {
      const shifted = analyzeLinks(rows(offset));
      expect(shifted.map((test) => [test.lag, test.level, test.direction])).toEqual(base.map((test) => [test.lag, test.level, test.direction]));
      shifted.forEach((test, i) => expect(test.t).toBeCloseTo(base[i]!.t, 9));
    }
  });

  it('carries the marks, the scales and every day in the signature', () => {
    const list = entries(START, moods(40, () => false), (i) => ({ activity_ids: i % 2 ? [1] : [] }));
    const base = linksSignature(input(list));
    expect(linksSignature(input([...list].reverse()))).toBe(base);
    expect(linksSignature(input(list, { activities: [{ id: 1, describesMood: true }] }))).not.toBe(base);
    expect(linksSignature(input(list, { today: '2027-01-01' as DateString }))).not.toBe(base);
    expect(linksSignature(input(list.map((entry, i) => (i === 7 ? { ...entry, level: 1 } : entry))))).not.toBe(base);
    expect(linksSignature(input(list.map((entry, i) => (i === 8 ? { ...entry, activity_ids: [1] } : entry))))).not.toBe(base);
    const scale = { id: 1, name: 'Energie', min: 1, max: 5, kind: 'rating' as const, describesMood: false };
    expect(linksSignature(input(list, { scales: [scale] }))).not.toBe(base);
    expect(linksSignature(input(list, { scales: [{ ...scale, describesMood: true }] }))).not.toBe(linksSignature(input(list, { scales: [scale] })));
  });
});
