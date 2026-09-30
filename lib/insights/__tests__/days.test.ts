import { buildDays, dayTexts } from '../days';
import { daysIn, previousWindow, rangeWindow, windowLength } from '../range';
import { mean, median, shrinkFactor, standardDeviation } from '../stats';
import { formatDecimal, formatPercent, formatSigned } from '../format';
import { d, entry } from './fixtures';

describe('buildDays', () => {
  it('is empty without entries', () => {
    expect(buildDays([])).toEqual([]);
  });

  it('merges entries of a day: mean level, rounded level, union of activities, oldest day first', () => {
    const days = buildDays([entry('2026-09-02', 5, [1]), entry('2026-09-01', 3, [1, 2]), entry('2026-09-01', 4, [3])]);
    expect(days.map((day) => day.date)).toEqual(['2026-09-01', '2026-09-02']);
    expect(days[0]).toMatchObject({ mean: 3.5, level: 4, count: 2 });
    expect([...days[0]!.activities].sort()).toEqual([1, 2, 3]);
  });

  it('joins title and notes of a day and skips empty ones', () => {
    const texts = dayTexts([
      { ...entry('2026-09-01', 4, [], 'Morgens'), note_title: 'Titel' },
      entry('2026-09-01', 4, [], 'Abends'),
      entry('2026-09-02', 4, [], '  '),
    ]);
    expect(texts.get(d('2026-09-01'))).toBe('Titel\nMorgens\nAbends');
    expect(texts.has(d('2026-09-02'))).toBe(false);
  });
});

describe('ranges', () => {
  const today = d('2026-09-26');

  it('ends today and counts today in', () => {
    expect(rangeWindow('30', today, d('2025-01-01'))).toEqual({ from: '2026-08-28', to: '2026-09-26' });
    expect(windowLength(rangeWindow('90', today, null))).toBe(90);
    expect(windowLength(rangeWindow('365', today, null))).toBe(365);
  });

  it('starts "all" with the first entry, or today without one', () => {
    expect(rangeWindow('all', today, d('2025-12-29'))).toEqual({ from: '2025-12-29', to: '2026-09-26' });
    expect(rangeWindow('all', today, null)).toEqual({ from: today, to: today });
  });

  it('compares with the window before only when the diary covers all of it', () => {
    const window = rangeWindow('30', today, null);
    expect(previousWindow('30', window, d('2026-07-29'))).toEqual({ from: '2026-07-29', to: '2026-08-27' });
    expect(previousWindow('30', window, d('2026-07-30'))).toBeNull();
    expect(previousWindow('all', rangeWindow('all', today, d('2025-01-01')), d('2025-01-01'))).toBeNull();
    expect(previousWindow('30', window, null)).toBeNull();
  });

  it('filters days to the window, both ends included', () => {
    const days = buildDays([entry('2026-08-27', 3), entry('2026-08-28', 4), entry('2026-09-26', 5)]);
    expect(daysIn(days, rangeWindow('30', today, null)).map((day) => day.date)).toEqual(['2026-08-28', '2026-09-26']);
  });
});

describe('stats', () => {
  it('computes mean, median and population standard deviation, null when empty', () => {
    expect(mean([])).toBeNull();
    expect(mean([3, 4, 5])).toBe(4);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
    // Deviations -1, 1: variance 1.
    expect(standardDeviation([3, 5])).toBe(1);
    expect(standardDeviation([4, 4, 4])).toBe(0);
    expect(standardDeviation([])).toBeNull();
  });

  it('shrinks with n / (n + k)', () => {
    expect(shrinkFactor(0)).toBe(0);
    expect(shrinkFactor(10)).toBe(0.5);
    expect(shrinkFactor(6, 10)).toBeCloseTo(0.375);
    expect(shrinkFactor(90, 10)).toBe(0.9);
  });
});

describe('format', () => {
  it('writes German numbers', () => {
    expect(formatDecimal(4.25, 1)).toBe('4,3');
    expect(formatDecimal(3.7949, 2)).toBe('3,79');
    expect(formatSigned(0.44)).toBe('+0,4');
    expect(formatSigned(-0.16)).toBe('-0,2');
    expect(formatSigned(-0.01)).toBe('0,0');
    expect(formatPercent(0.737)).toBe('74 %');
  });

  it('rounds half up on the decimal value, not on its binary approximation', () => {
    expect(formatDecimal(87 / 20)).toBe('4,4');
    expect(formatDecimal(4.45)).toBe('4,5');
    expect(formatDecimal(1.005, 2)).toBe('1,01');
    expect(formatDecimal(-0.04)).toBe('0,0');
    expect(formatDecimal(1e-7, 2)).toBe('0,00');
    expect(formatPercent(0.285)).toBe('29 %');
    expect(formatPercent(0.145)).toBe('15 %');
  });
});
