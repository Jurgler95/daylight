/**
 * Which design a day wears: a festival inside its window wins over the season; where two windows
 * overlap, the one whose anchor day is nearer. Seasons are meteorological, northern hemisphere.
 * Pure and loadable by Node as well (the store icon workflow asks it for today), hence the
 * relative imports with extension.
 */
import { addDaysToDateString, dateOf, daysBetween, type DateString } from '../dates/days.ts';

import type { DesignKey, FestivalKey, SeasonKey } from './designs.ts';

/** Days before and after each festival's anchor day that still wear its design. */
export const FESTIVAL_WINDOWS: Record<FestivalKey, { before: number; after: number }> = {
  ostern: { before: 3, after: 1 },
  halloween: { before: 4, after: 0 },
  weihnachten: { before: 4, after: 2 },
  silvester: { before: 4, after: 5 },
  neujahrsfest: { before: 4, after: 4 },
};

/**
 * The lunar new year by Gregorian date, `[month, day]`. Years without an entry have no festival;
 * extend the table before 2036 runs out.
 */
export const LUNAR_NEW_YEAR: Readonly<Record<number, readonly [number, number]>> = {
  2025: [1, 29],
  2026: [2, 17],
  2027: [2, 6],
  2028: [1, 26],
  2029: [2, 13],
  2030: [2, 3],
  2031: [1, 23],
  2032: [2, 11],
  2033: [1, 31],
  2034: [2, 19],
  2035: [2, 8],
  2036: [1, 28],
};

/** Easter Sunday, by the anonymous Gregorian algorithm (Meeus, Jones, Butcher). */
export function easterSunday(year: number): DateString {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dateOf(year, month, day);
}

/** The anchor day of a festival in `year`, null where the year has none (lunar table runs out). */
export function festivalAnchor(key: FestivalKey, year: number): DateString | null {
  switch (key) {
    case 'ostern':
      return easterSunday(year);
    case 'halloween':
      return dateOf(year, 10, 31);
    case 'weihnachten':
      return dateOf(year, 12, 24);
    case 'silvester':
      return dateOf(year, 12, 31);
    case 'neujahrsfest': {
      const date = LUNAR_NEW_YEAR[year];
      return date ? dateOf(year, date[0], date[1]) : null;
    }
  }
}

export function seasonOf(day: DateString): SeasonKey {
  const month = Number(day.slice(5, 7));
  return month >= 3 && month <= 5 ? 'fruehling' : month >= 6 && month <= 8 ? 'sommer' : month >= 9 && month <= 11 ? 'herbst' : 'winter';
}

/** The festival whose window holds `day`, the nearer anchor if two do, or null. */
export function festivalOn(day: DateString): FestivalKey | null {
  const year = Number(day.slice(0, 4));
  let best: { key: FestivalKey; distance: number } | null = null;
  for (const key of Object.keys(FESTIVAL_WINDOWS) as FestivalKey[]) {
    const { before, after } = FESTIVAL_WINDOWS[key];
    // A window may reach over the turn of the year (Silvester runs into January).
    for (const y of [year - 1, year, year + 1]) {
      const anchor = festivalAnchor(key, y);
      if (!anchor) continue;
      if (day < addDaysToDateString(anchor, -before) || day > addDaysToDateString(anchor, after)) continue;
      const distance = Math.abs(daysBetween(anchor, day));
      if (!best || distance < best.distance) best = { key, distance };
    }
  }
  return best?.key ?? null;
}

export interface DesignChoice {
  /** "Design zur Jahreszeit": off brings the plain logo back everywhere. */
  seasons: boolean;
  /** "Designs zu Festen": off leaves only the seasons. Only counts while `seasons` is on. */
  festivals: boolean;
}

/** The design `day` wears, or null for the plain logo. */
export function activeDesign(day: DateString, choice: DesignChoice = { seasons: true, festivals: true }): DesignKey | null {
  if (!choice.seasons) return null;
  return (choice.festivals ? festivalOn(day) : null) ?? seasonOf(day);
}
