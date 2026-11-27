import { applyLanguage } from '@/lib/i18n';

import { formatEntryValue, formatScaleDifference, formatScaleValue } from '../format';
import { cleanUnit, parseNumberInput, roundToDecimals } from '../number';
import { numberChartRange } from '../range';

const weight = { kind: 'number' as const, unit: 'kg', decimals: 1 };
const glasses = { kind: 'number' as const, unit: '', decimals: 0 };

describe('parseNumberInput', () => {
  it('reads comma and dot, ignores spaces, empty is no value', () => {
    expect(parseNumberInput('72,4', 1)).toBe(72.4);
    expect(parseNumberInput('72.4', 1)).toBe(72.4);
    expect(parseNumberInput(' 1 200,5 ', 1)).toBe(1200.5);
    expect(parseNumberInput('-3', 0)).toBe(-3);
    expect(parseNumberInput(',5', 2)).toBe(0.5);
    expect(parseNumberInput('72,', 1)).toBe(72);
    expect(parseNumberInput('', 1)).toBeNull();
    expect(parseNumberInput('   ', 1)).toBeNull();
  });

  it('refuses more decimals than the scale has, so a thousands separator never shrinks a value', () => {
    expect(parseNumberInput('72,46', 1)).toBe('tooPrecise');
    expect(parseNumberInput('1.500', 0)).toBe('tooPrecise');
    expect(parseNumberInput('2,5', 0)).toBe('tooPrecise');
    expect(parseNumberInput('1,05', 2)).toBe(1.05);
    expect(parseNumberInput('-0', 0)).toBe(0);
  });

  it('refuses what is not a number or out of range', () => {
    for (const text of ['abc', '7,2,4', '1e5', '-', '.', '72 kg', '1000000']) expect(parseNumberInput(text, 1)).toBe('invalid');
  });
});

describe('roundToDecimals and cleanUnit', () => {
  it('round half away from zero without binary noise', () => {
    expect(roundToDecimals(72.35, 1)).toBe(72.4);
    expect(roundToDecimals(-0.04, 1)).toBe(0);
    expect(Object.is(roundToDecimals(-0.04, 1), -0)).toBe(false);
  });

  it('trims units and cuts them short', () => {
    expect(cleanUnit('  mmol / l ')).toBe('mmol / l');
    expect(cleanUnit('a very long unit name')).toBe('a very long');
  });
});

describe('formatting a number scale', () => {
  beforeAll(() => applyLanguage('de'));

  it('shows an entry as entered, with its unit', () => {
    expect(formatEntryValue(weight, 72.4)).toBe('72,4 kg');
    expect(formatEntryValue(weight, 72)).toBe('72,0 kg');
    expect(formatEntryValue(glasses, 6)).toBe('6');
    expect(formatEntryValue({ kind: 'rating' }, 4)).toBe('4');
  });

  it('keeps at least one decimal for means and signs differences', () => {
    expect(formatScaleValue(glasses, 2.5)).toBe('2,5');
    expect(formatScaleValue(weight, 72.44)).toBe('72,4 kg');
    expect(formatScaleValue({ ...weight, decimals: 2 }, 72.444)).toBe('72,44 kg');
    expect(formatScaleDifference(weight, -1.24)).toBe('-1,2 kg');
    expect(formatScaleDifference(weight, 0.01)).toBe('0,0 kg');
  });
});

describe('numberChartRange', () => {
  it('hugs the values with a tenth of their spread', () => {
    const [lo, hi] = numberChartRange([71, 73], 1);
    expect(lo).toBeCloseTo(70.8);
    expect(hi).toBeCloseTo(73.2);
  });

  it('still has an axis for equal values or none', () => {
    expect(numberChartRange([5, 5], 0)).toEqual([4, 6]);
    expect(numberChartRange([], 1)).toEqual([0, 1]);
  });
});
