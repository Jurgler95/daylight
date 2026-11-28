import { coverage } from '../coverage';
import { dayTexts } from '../days';
import type { ScaleFacts } from '../scales';
import { noteWords, scaleWords, wordDetail, words } from '../words';
import { d, days, entry } from './fixtures';

describe('words', () => {
  it('splits on anything but letters, folds, drops stopwords, short words and repeats', () => {
    expect([...words('Heute war die Sonne da, und die SONNE, und Müde-Wandern! 42 km')]).toEqual([
      ['sonne', 'Sonne'],
      ['mude', 'Müde'],
      ['wandern', 'Wandern'],
    ]);
  });
});

describe('noteWords', () => {
  // Five good days, four less good ones.
  const entries = [
    entry('2026-09-01', 5, [], 'Sonne und Sonne'),
    entry('2026-09-02', 4, [], 'sonne'),
    entry('2026-09-03', 4, [], 'Sonne am See'),
    entry('2026-09-04', 4, [], 'Nichts'),
    entry('2026-09-05', 5),
    entry('2026-09-06', 3, [], 'Streit und Sonne'),
    entry('2026-09-07', 2, [], 'Streit'),
    entry('2026-09-08', 3, [], 'wieder Streit'),
    entry('2026-09-09', 3, [], 'Nichts'),
  ];
  const result = noteWords(days(entries), dayTexts(entries));

  it('counts days per side and lists words that lean to one side', () => {
    expect(result.goodDays).toBe(5);
    expect(result.lowDays).toBe(4);
    // Ratios count days with a note only (4 good, 4 others). Sonne: 3 of 4 against 1 of 4: (4 / 6) / (2 / 6) = 2.
    expect(result.good).toEqual([{ word: 'Sonne', days: 3, otherDays: 1, ratio: expect.closeTo(2, 10) }]);
    // Streit: 3 of 4 against 0 of 4: (4 / 6) / (1 / 6) = 4.
    expect(result.low).toEqual([{ word: 'Streit', days: 3, otherDays: 0, ratio: expect.closeTo(4, 10) }]);
  });

  it('compares days with a note, so writing more on some days does not tilt every word', () => {
    // Twenty good days, only four of them with a note; four other days, all with a note. "Garten" is
    // in every note, so it leans to neither side.
    const good = Array.from({ length: 20 }, (_, i) => entry(`2026-08-${String(i + 1).padStart(2, '0')}`, 4, [], i < 4 ? 'Garten' : null));
    const other = Array.from({ length: 4 }, (_, i) => entry(`2026-08-${21 + i}`, 3, [], 'Garten'));
    const all = [...good, ...other];
    expect(noteWords(days(all), dayTexts(all))).toMatchObject({ goodDays: 20, lowDays: 4, good: [], low: [] });
  });

  it('is empty without notes', () => {
    expect(noteWords([], new Map())).toEqual({ goodDays: 0, lowDays: 0, good: [], low: [] });
  });
});

const stress: ScaleFacts = { id: 7, name: 'Stress', min: 1, max: 5, kind: 'rating' };
/** An entry with a stress value, a note and activities. */
const scaled = (date: string, level: number, value: number | null, note: string | null, activities: number[] = []) => ({
  ...entry(date, level, activities, note),
  scales: value === null ? [] : [{ scale_id: stress.id, value }],
});

describe('scaleWords', () => {
  // Median 3: four days above, four below, the two at 3 count on neither side.
  const entries = [
    scaled('2026-09-01', 2, 5, 'Arbeit und Termin'),
    scaled('2026-09-02', 2, 5, 'Arbeit'),
    scaled('2026-09-03', 3, 4, 'Arbeit, Garten'),
    scaled('2026-09-04', 3, 4, 'Garten'),
    scaled('2026-09-05', 3, 3, 'Arbeit'),
    scaled('2026-09-06', 3, 3, 'Arbeit'),
    scaled('2026-09-07', 4, 2, 'Garten und Sonne'),
    scaled('2026-09-08', 4, 1, 'Sonne'),
    scaled('2026-09-09', 5, 1, 'Sonne am See'),
    scaled('2026-09-10', 4, 2, null),
    scaled('2026-09-11', 4, null, 'Sonne'),
  ];
  const result = scaleWords(days(entries), dayTexts(entries), stress);

  it('splits at the median and leaves the days right at it out', () => {
    expect(result.median).toBe(3);
    expect(result.highDays).toBe(4);
    expect(result.lowDays).toBe(4);
    // Ratios count days with a note: 4 high, 3 low. Arbeit: 3 of 4 against 0 of 3: (4 / 6) / (1 / 5).
    expect(result.high).toEqual([{ word: 'Arbeit', days: 3, otherDays: 0, ratio: expect.closeTo(10 / 3, 10) }]);
    // Sonne: 3 of 3 against 0 of 4; the day without a stress value does not count.
    expect(result.low).toEqual([{ word: 'Sonne', days: 3, otherDays: 0, ratio: expect.closeTo((4 / 5) / (1 / 6), 10) }]);
  });

  it('is empty when the scale has no value', () => {
    expect(scaleWords(days(entries), dayTexts(entries), { ...stress, id: 99 })).toEqual({ highDays: 0, lowDays: 0, median: null, high: [], low: [] });
  });
});

describe('wordDetail', () => {
  // "Garten" on six days with a note, five other days with a note, three days without one.
  const garden = Array.from({ length: 6 }, (_, i) => scaled(`2026-09-${String(i + 1).padStart(2, '0')}`, 5, 1, i === 0 ? 'Im GARTEN' : 'Garten gegossen', [1]));
  const others = Array.from({ length: 5 }, (_, i) => scaled(`2026-09-${String(i + 11).padStart(2, '0')}`, 3, 4, 'Büro', [2]));
  const silent = Array.from({ length: 3 }, (_, i) => scaled(`2026-09-${String(i + 21).padStart(2, '0')}`, 1, 5, null, [2]));
  const all = [...garden, ...others, ...silent];
  const result = wordDetail(days(all), dayTexts(all), 'garten', [stress]);

  it('finds the days with the word in any spelling, newest first, out of the days with a note', () => {
    expect(result.word).toBe('Garten');
    expect(result.days.map((day) => day.date)).toEqual(['2026-09-06', '2026-09-05', '2026-09-04', '2026-09-03', '2026-09-02', '2026-09-01']);
    expect(result.noteDays).toBe(11);
    expect(result.share).toBeCloseTo(6 / 11);
  });

  it('compares mood, scales and activities with the other days with a note only', () => {
    expect(result.withMean).toBe(5);
    // The three days without a note (mood 1, stress 5) stay out.
    expect(result.withoutMean).toBe(3);
    expect(result.scales).toEqual([{ scale: stress, withMean: 1, withoutMean: 4, withDays: 6, withoutDays: 5 }]);
    expect(result.activities.typical.map((row) => row.activityId)).toEqual([1]);
    expect(result.activities.rare.map((row) => row.activityId)).toEqual([2]);
    expect(result.withLevels.find((row) => row.level === 5)?.days).toBe(6);
  });

  it('leaves the mood out below the minimum on either side and is empty for an unknown word', () => {
    const few = [...garden.slice(0, 2), ...others];
    expect(wordDetail(days(few), dayTexts(few), 'Garten', []).withMean).toBeNull();
    const none = wordDetail(days(all), dayTexts(all), 'Wolke', [stress]);
    expect(none).toMatchObject({ word: 'Wolke', days: [], share: 0, withMean: null });
    expect(none.activities).toEqual({ typical: [], rare: [] });
  });
});

describe('coverage', () => {
  const entries = [entry('2026-09-01', 4, [], null, '20:00'), entry('2026-09-01', 4, [], null, '21:10'), entry('2026-09-03', 4, [], null, '08:30'), entry('2026-08-01', 4)];

  it('counts entries, days, share of the span and the usual time', () => {
    const result = coverage(entries, { from: d('2026-09-01'), to: d('2026-09-10') }, d('2026-08-01'));
    expect(result).toMatchObject({ entries: 3, days: 2, spanDays: 10, share: 0.2, typicalTime: '20:00' });
    expect(result!.hours[20]).toBe(1);
    expect(result!.hours[21]).toBe(1);
    expect(result!.hours[8]).toBe(1);
  });

  it('keeps late evenings and the hour after midnight together for the usual time', () => {
    const late = [entry('2026-09-01', 4, [], null, '23:30'), entry('2026-09-02', 4, [], null, '23:50'), entry('2026-09-03', 4, [], null, '00:10'), entry('2026-09-04', 4, [], null, '00:20')];
    expect(coverage(late, { from: d('2026-09-01'), to: d('2026-09-04') }, d('2026-09-01'))?.typicalTime).toBe('00:00');
  });

  it('starts the span at the first entry when that is inside the window', () => {
    expect(coverage(entries.slice(0, 3), { from: d('2026-08-28'), to: d('2026-09-10') }, d('2026-09-01'))?.spanDays).toBe(10);
  });

  it('is null without entries in the window', () => {
    expect(coverage(entries, { from: d('2026-10-01'), to: d('2026-10-10') }, d('2026-08-01'))).toBeNull();
    expect(coverage([], { from: d('2026-10-01'), to: d('2026-10-10') }, null)).toBeNull();
  });
});
