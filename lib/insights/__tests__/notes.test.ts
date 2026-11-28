import { dayTexts } from '../days';
import { countWords, noteStats } from '../notes';
import { d, days, entry } from './fixtures';

describe('countWords', () => {
  it('counts every run of letters or digits, stopwords included', () => {
    expect(countWords('Heute war es schön, 3 km gelaufen!')).toBe(7);
    expect(countWords('  ')).toBe(0);
  });
});

describe('noteStats', () => {
  const entries = [
    entry('2026-09-01', 5, [], 'Sonne am See'),
    entry('2026-09-02', 5, [], 'Sonne und Wandern'),
    entry('2026-09-03', 4, [], 'Wandern mit Anna im Wald und danach Sonne'),
    entry('2026-09-04', 4),
    entry('2026-09-05', 2, [], 'Streit'),
    entry('2026-09-06', 3),
    entry('2026-09-07', 3),
  ];
  const result = noteStats(days(entries), dayTexts(entries));

  it('counts days with a note, their words and the longest one', () => {
    expect(result.days).toBe(4);
    expect(result.totalDays).toBe(7);
    expect(result.share).toBeCloseTo(4 / 7);
    expect(result.words).toBe(3 + 3 + 8 + 1);
    expect(result.meanWords).toBeCloseTo(15 / 4);
    expect(result.longest).toEqual({ date: d('2026-09-03'), words: 8 });
  });

  it('compares the mood with and without a note once both sides have enough days', () => {
    expect(result.withMean).toBeCloseTo((5 + 5 + 4 + 2) / 4);
    expect(result.withoutMean).toBeCloseTo((4 + 3 + 3) / 3);
    const few = entries.slice(0, 5);
    expect(noteStats(days(few), dayTexts(few)).withMean).toBeNull();
  });

  it('gives the share of days with a note per mood, best first', () => {
    expect(result.byLevel.map((row) => [row.level, row.withNote, row.days])).toEqual([
      [5, 2, 2],
      [4, 1, 2],
      [3, 0, 2],
      [2, 1, 1],
      [1, 0, 0],
    ]);
  });

  it('lists words of at least two days, most days first, without stopwords', () => {
    expect(result.top).toEqual([
      { word: 'Sonne', days: 3 },
      { word: 'Wandern', days: 2 },
    ]);
  });

  it('stays empty without notes', () => {
    const plain = [entry('2026-09-01', 3)];
    const empty = noteStats(days(plain), dayTexts(plain));
    expect(empty).toMatchObject({ days: 0, words: 0, meanWords: null, longest: null, top: [] });
  });
});
