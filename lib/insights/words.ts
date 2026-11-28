import type { DateString } from '@/lib/dates';
import { fold } from '@/lib/search/fold';

import type { InsightDay } from './days';
import { activityContrast, levelCounts, type ActivityContrast, type LevelCount } from './detail';
import { MIN_SIDE_DAYS } from './effects';
import { compareScales, scaleDayValue, type ScaleComparison, type ScaleFacts } from './scales';
import { mean, median } from './stats';
import { STOPWORDS } from './stopwords';

/** A word has to show up on this many days of its side. */
export const MIN_WORD_DAYS = 3;
/** Shorter words are almost always fillers. */
export const MIN_WORD_LENGTH = 3;
/** Days from this rounded level up are "good", the rest "less good". */
export const GOOD_LEVEL = 4;
/** And be this much more common there than on the other side. */
export const MIN_WORD_RATIO = 1.5;
/** Words named per side. */
export const WORDS_SHOWN = 8;

/** Latin letters including umlauts and accents; everything else splits words. */
const WORD = /[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ]+/g;

export interface WordStat {
  /** The spelling used most often. */
  word: string;
  /** Days on the side the word is listed for. */
  days: number;
  /** Days on the other side. */
  otherDays: number;
  /** Smoothed rate on this side over the rate on the other side. */
  ratio: number;
}

export interface NoteWords {
  goodDays: number;
  lowDays: number;
  /** More common on days at "Gut" or better. */
  good: WordStat[];
  /** More common on the other days. */
  low: WordStat[];
}

/** Distinct folded words of a text, each with the spelling it had. */
export function words(text: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of text.matchAll(WORD)) {
    const raw = match[0];
    if (raw.length < MIN_WORD_LENGTH) continue;
    const key = fold(raw);
    if (STOPWORDS.has(key) || found.has(key)) continue;
    found.set(key, raw);
  }
  return found;
}

/** The two sides of a word comparison and how many days each has, notes or not. */
export interface WordSplit {
  aDays: number;
  bDays: number;
  /** More common on side `a`, strongest first. */
  a: WordStat[];
  b: WordStat[];
}

/**
 * Words that come up more on one side of the days than on the other. `side` puts a day on `a`, on
 * `b` or (null) on neither. Counted in days, not occurrences, so one long note cannot carry a word.
 * Ratios compare shares of days with a note, since days without one cannot contain any word, and
 * use add-one smoothing, so a word on 3 of 3 days against 0 of 200 does not become infinite.
 */
export function splitWords(days: readonly InsightDay[], texts: ReadonlyMap<DateString, string>, side: (day: InsightDay) => 'a' | 'b' | null): WordSplit {
  const counts = { a: new Map<string, number>(), b: new Map<string, number>() };
  const spellings = new Map<string, Map<string, number>>();
  const dayCount = { a: 0, b: 0 };
  const textCount = { a: 0, b: 0 };
  for (const day of days) {
    const which = side(day);
    if (!which) continue;
    dayCount[which] += 1;
    const text = texts.get(day.date);
    if (!text) continue;
    textCount[which] += 1;
    const map = counts[which];
    for (const [key, raw] of words(text)) {
      map.set(key, (map.get(key) ?? 0) + 1);
      const forms = spellings.get(key) ?? new Map<string, number>();
      forms.set(raw, (forms.get(raw) ?? 0) + 1);
      spellings.set(key, forms);
    }
  }
  const spelling = (key: string) => [...spellings.get(key)!.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]![0];
  const rank = (mine: Map<string, number>, other: Map<string, number>, sideTexts: number, otherTexts: number): WordStat[] =>
    [...mine.entries()]
      .filter(([, n]) => n >= MIN_WORD_DAYS)
      .map(([key, n]) => {
        const o = other.get(key) ?? 0;
        return { word: spelling(key), days: n, otherDays: o, ratio: (n + 1) / (sideTexts + 2) / ((o + 1) / (otherTexts + 2)) };
      })
      .filter((stat) => stat.ratio >= MIN_WORD_RATIO)
      .sort((a, b) => b.ratio - a.ratio || b.days - a.days || (a.word < b.word ? -1 : 1))
      .slice(0, WORDS_SHOWN);
  return {
    aDays: dayCount.a,
    bDays: dayCount.b,
    a: rank(counts.a, counts.b, textCount.a, textCount.b),
    b: rank(counts.b, counts.a, textCount.b, textCount.a),
  };
}

/**
 * Words that come up more on good days than on the others, and the other way round. The good side
 * is "Gut" and better, the other everything below: difficult days alone ("Schlecht" and worse) are
 * too rare in most diaries for any word to reach three days. Everything stays on the device.
 */
export function noteWords(days: readonly InsightDay[], texts: ReadonlyMap<DateString, string>): NoteWords {
  const split = splitWords(days, texts, (day) => (day.level >= GOOD_LEVEL ? 'a' : 'b'));
  return { goodDays: split.aDays, lowDays: split.bDays, good: split.a, low: split.b };
}

export interface ScaleWords {
  /** Days with a value above and below the median; days right at it count on neither side. */
  highDays: number;
  lowDays: number;
  median: number | null;
  high: WordStat[];
  low: WordStat[];
}

/**
 * Words that come up more on days with a high value of a scale than on days with a low one, split
 * at the median of the days given. Days right at the median are left out, so a rating from 1 to 5
 * with a median of 3 compares 4 and 5 against 1 and 2.
 */
export function scaleWords(days: readonly InsightDay[], texts: ReadonlyMap<DateString, string>, scale: ScaleFacts): ScaleWords {
  const middle = median(days.flatMap((day) => scaleDayValue(day, scale) ?? []));
  if (middle === null) return { highDays: 0, lowDays: 0, median: null, high: [], low: [] };
  const split = splitWords(days, texts, (day) => {
    const value = scaleDayValue(day, scale);
    if (value === null || value === middle) return null;
    return value > middle ? 'a' : 'b';
  });
  return { highDays: split.aDays, lowDays: split.bDays, median: middle, high: split.a, low: split.b };
}

export interface WordDetail {
  /** The spelling used most often; the word as asked for when it is nowhere. */
  word: string;
  /** Days whose note contains the word, newest first. */
  days: InsightDay[];
  /** Days with a note at all, for "an 12 von 80 Tagen mit Notiz". */
  noteDays: number;
  /** Share of days with a note. */
  share: number;
  withLevels: LevelCount[];
  withoutLevels: LevelCount[];
  /** Mean mood with and without the word; null below `MIN_SIDE_DAYS` on either side. */
  withMean: number | null;
  withoutMean: number | null;
  /** Activities more and less common on days with the word than on the other days with a note. */
  activities: ActivityContrast;
  /** Scales on days with the word against the other days with a note. */
  scales: ScaleComparison[];
}

/**
 * Everything about one word, like the page of an activity. Days with the word are compared only
 * with the other days that have a note: on days without one nothing could have been written, and
 * writing at all already goes with the mood (see `noteStats`).
 */
export function wordDetail(days: readonly InsightDay[], texts: ReadonlyMap<DateString, string>, word: string, scales: readonly ScaleFacts[]): WordDetail {
  const key = fold(word);
  const spellingCounts = new Map<string, number>();
  const noted = days.filter((day) => texts.has(day.date));
  const hits = new Set<DateString>();
  for (const day of noted) {
    const raw = words(texts.get(day.date)!).get(key);
    if (raw === undefined) continue;
    hits.add(day.date);
    spellingCounts.set(raw, (spellingCounts.get(raw) ?? 0) + 1);
  }
  const has = (day: InsightDay) => hits.has(day.date);
  const withDays = noted.filter(has);
  const withoutDays = noted.filter((day) => !has(day));
  const enough = withDays.length >= MIN_SIDE_DAYS && withoutDays.length >= MIN_SIDE_DAYS;
  const spelling = [...spellingCounts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? word;
  return {
    word: spelling,
    days: [...withDays].reverse(),
    noteDays: noted.length,
    share: noted.length ? withDays.length / noted.length : 0,
    withLevels: levelCounts(withDays),
    withoutLevels: levelCounts(withoutDays),
    withMean: enough ? mean(withDays.map((day) => day.mean)) : null,
    withoutMean: enough ? mean(withoutDays.map((day) => day.mean)) : null,
    activities: withDays.length ? activityContrast(noted, has) : { typical: [], rare: [] },
    scales: compareScales(noted, scales, has),
  };
}
