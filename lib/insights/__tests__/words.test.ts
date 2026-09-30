import { coverage } from '../coverage';
import { dayTexts } from '../days';
import { noteWords, words } from '../words';
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
