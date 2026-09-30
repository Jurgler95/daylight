import type { DateString } from '@/lib/dates';
import { fold } from '@/lib/search/fold';

import type { InsightDay } from './days';
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

/**
 * Words that come up more on good days than on the others, and the other way round. Counted in
 * days, not occurrences, so one long note cannot carry a word. The good side is "Gut" and better,
 * the other everything below: difficult days alone ("Schlecht" and worse) are too rare in most
 * diaries for any word to reach three days. Ratios use add-one smoothing, so a word on 3 of 3
 * days against 0 of 200 does not become infinite. Everything stays on the device.
 */
export function noteWords(days: readonly InsightDay[], texts: ReadonlyMap<DateString, string>): NoteWords {
  const good = new Map<string, number>();
  const low = new Map<string, number>();
  const spellings = new Map<string, Map<string, number>>();
  let goodDays = 0;
  let lowDays = 0;
  // Ratios compare shares of days with a note: days without one cannot contain any word.
  let goodTexts = 0;
  let lowTexts = 0;
  for (const day of days) {
    const isGood = day.level >= GOOD_LEVEL;
    if (isGood) goodDays += 1;
    else lowDays += 1;
    const text = texts.get(day.date);
    if (!text) continue;
    if (isGood) goodTexts += 1;
    else lowTexts += 1;
    const side = isGood ? good : low;
    for (const [key, raw] of words(text)) {
      side.set(key, (side.get(key) ?? 0) + 1);
      const forms = spellings.get(key) ?? new Map<string, number>();
      forms.set(raw, (forms.get(raw) ?? 0) + 1);
      spellings.set(key, forms);
    }
  }
  const spelling = (key: string) => [...spellings.get(key)!.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]![0];
  const rank = (side: Map<string, number>, other: Map<string, number>, sideDays: number, otherDays: number): WordStat[] =>
    [...side.entries()]
      .filter(([, n]) => n >= MIN_WORD_DAYS)
      .map(([key, n]) => {
        const o = other.get(key) ?? 0;
        return { word: spelling(key), days: n, otherDays: o, ratio: (n + 1) / (sideDays + 2) / ((o + 1) / (otherDays + 2)) };
      })
      .filter((stat) => stat.ratio >= MIN_WORD_RATIO)
      .sort((a, b) => b.ratio - a.ratio || b.days - a.days || (a.word < b.word ? -1 : 1))
      .slice(0, WORDS_SHOWN);
  return { goodDays, lowDays, good: rank(good, low, goodTexts, lowTexts), low: rank(low, good, lowTexts, goodTexts) };
}
