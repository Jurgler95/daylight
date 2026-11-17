import type { DateString } from '@/lib/dates';

import { activeDesign, easterSunday, festivalAnchor, seasonOf } from '../calendar';

const day = (value: string) => value as DateString;
const on = (value: string) => activeDesign(day(value));

describe('Easter', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2038, '2038-04-25'],
  ])('falls in %i on %s', (year, expected) => {
    expect(easterSunday(year)).toBe(expected);
  });

  it('wears its design from three days before Easter Sunday to the Monday after', () => {
    expect(on('2027-03-24')).toBe('fruehling');
    expect(on('2027-03-25')).toBe('ostern');
    expect(on('2027-03-29')).toBe('ostern');
    expect(on('2027-03-30')).toBe('fruehling');
  });
});

describe('festival windows', () => {
  it('ends Halloween on 31 October', () => {
    expect(on('2026-10-26')).toBe('herbst');
    expect(on('2026-10-27')).toBe('halloween');
    expect(on('2026-10-31')).toBe('halloween');
    expect(on('2026-11-01')).toBe('herbst');
  });

  it('hands Christmas over to New Year without a gap', () => {
    expect(on('2026-12-19')).toBe('winter');
    expect(on('2026-12-20')).toBe('weihnachten');
    expect(on('2026-12-26')).toBe('weihnachten');
    expect(on('2026-12-27')).toBe('silvester');
  });

  it('keeps New Year across the turn of the year', () => {
    expect(on('2027-01-02')).toBe('silvester');
    expect(on('2027-01-05')).toBe('silvester');
    expect(on('2027-01-06')).toBe('winter');
  });

  it('places the Lunar New Year from the table, 6 February 2027 with four days either side', () => {
    expect(festivalAnchor('neujahrsfest', 2027)).toBe('2027-02-06');
    expect(on('2027-02-01')).toBe('winter');
    expect(on('2027-02-02')).toBe('neujahrsfest');
    expect(on('2027-02-10')).toBe('neujahrsfest');
    expect(on('2027-02-11')).toBe('winter');
  });

  it('leaves the Lunar New Year out in a year without an entry', () => {
    expect(festivalAnchor('neujahrsfest', 2037)).toBeNull();
    // 15 February 2037 would be the festival; without an entry the season stays.
    expect(on('2037-02-15')).toBe('winter');
  });
});

describe('priority and switches', () => {
  it('lets a festival win over the season', () => {
    expect(seasonOf(day('2026-12-24'))).toBe('winter');
    expect(on('2026-12-24')).toBe('weihnachten');
  });

  it('shows only the season without festival designs, and the logo without any', () => {
    expect(activeDesign(day('2026-12-24'), { seasons: true, festivals: false })).toBe('winter');
    expect(activeDesign(day('2026-12-24'), { seasons: false, festivals: true })).toBeNull();
    expect(activeDesign(day('2026-07-01'), { seasons: false, festivals: false })).toBeNull();
  });
});

describe('meteorological seasons', () => {
  it.each([
    ['2027-02-28', 'winter'],
    ['2028-02-29', 'winter'],
    ['2027-03-01', 'fruehling'],
    ['2027-05-31', 'fruehling'],
    ['2027-06-01', 'sommer'],
    ['2027-08-31', 'sommer'],
    ['2027-09-01', 'herbst'],
    ['2027-11-30', 'herbst'],
    ['2027-12-01', 'winter'],
  ])('%s is %s', (value, season) => {
    expect(seasonOf(day(value))).toBe(season);
    expect(on(value)).toBe(season);
  });
});
