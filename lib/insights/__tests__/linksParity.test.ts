import { buildDays } from '../days';
import { analyzeLinks, buildLinks, erfc, linkRows } from '../links';
import { usualRanges } from '../usual';

import { diaryEntries, diaryInput, diaryNames, factorName, loadDiary, loadErfc, loadExpected, SETS } from './diaries';

/**
 * The port against the two reference implementations it was made from, on all 36 test diaries and
 * without any mark: level, direction and usual range have to match exactly, the numbers to 1e-6.
 */
describe('erfc', () => {
  it('matches the reference to a relative error far below 1e-7', () => {
    for (const [x, value] of loadErfc()) {
      if (value === 0) expect(erfc(x)).toBe(0);
      else expect(Math.abs(erfc(x) / value - 1)).toBeLessThan(1e-10);
    }
    expect(erfc(-0.7)).toBeCloseTo(2 - erfc(0.7), 15);
  });
});

describe.each(SETS)('the %s diaries', (set) => {
  const names = diaryNames(set);

  it('are all there', () => {
    expect(names).toHaveLength(18);
  });

  it.each(names)('%s: every tested column as in the reference', (name) => {
    const diary = loadDiary(set, name);
    const expected = loadExpected(set, name).links;
    const input = diaryInput(diary);
    const tests = analyzeLinks(linkRows(input).rows);
    expect(tests.map((test) => [factorName(diary, test.key), test.lag, test.direction, test.level])).toEqual(
      expected.map((link) => [link.factor, link.lag, link.direction, link.level]),
    );
    tests.forEach((test, i) => {
      const link = expected[i]!;
      expect(Math.abs(test.t - link.t)).toBeLessThan(1e-6);
      expect(Math.abs(test.tAdjusted - link.tmin)).toBeLessThan(1e-6);
      expect(Math.abs(test.q - link.q)).toBeLessThan(1e-6);
    });
    // The lists the app shows are those columns with a level.
    const shown = buildLinks(input);
    expect(shown.describing).toEqual([]);
    expect(shown.findings.map((finding) => `${factorName(diary, finding.factor)}/${finding.lag}/${finding.direction}/${finding.level}`).sort()).toEqual(
      expected.filter((link) => link.level).map((link) => `${link.factor}/${link.lag}/${link.direction}/${link.level}`).sort(),
    );
  });

  it.each(names)('%s: the usual range of every day as in the reference', (name) => {
    const ranges = usualRanges(buildDays(diaryEntries(loadDiary(set, name))));
    const expected = loadExpected(set, name);
    expect(ranges.map((range) => range.lo).join('')).toBe(expected.lo);
    expect(ranges.map((range) => range.hi).join('')).toBe(expected.hi);
  });
});
