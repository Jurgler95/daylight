import { MOOD_LEVELS, type MoodLevel } from '@/db/schema';
import type { DateString } from '@/lib/dates';
import { fold } from '@/lib/search/fold';

import type { InsightDay } from './days';
import { mean } from './stats';
import { words } from './words';

/** Words named in "Häufigste Wörter". */
export const TOP_WORDS_SHOWN = 12;
/** A word needs this many days before it counts as frequent. */
export const MIN_TOP_WORD_DAYS = 2;
/** Below this many days with and without a note the mood comparison stays out. */
export const MIN_NOTE_SIDE_DAYS = 3;

/** Any run of letters or digits, for word counts (stopwords included, unlike `words`). */
const TOKEN = /[\p{L}\p{N}]+/gu;

export interface NoteLevel {
  level: MoodLevel;
  /** Days at this level in the window. */
  days: number;
  /** Of those, days with a note. */
  withNote: number;
  share: number;
}

export interface NoteStats {
  /** Days in the window with a note or a title. */
  days: number;
  /** Days with an entry in the window. */
  totalDays: number;
  share: number;
  /** All words written on those days. */
  words: number;
  /** Words per day with a note; null without one. */
  meanWords: number | null;
  /** Mean mood on days with and without a note; null below `MIN_NOTE_SIDE_DAYS` on either side. */
  withMean: number | null;
  withoutMean: number | null;
  /** Best mood first: how often a note was written at each level. */
  byLevel: NoteLevel[];
  /** Words on the most days, stopwords left out, in the spelling used most. */
  top: { word: string; days: number }[];
  /** The day with the most words; null without notes. */
  longest: { date: DateString; words: number } | null;
}

export function countWords(text: string): number {
  return text.match(TOKEN)?.length ?? 0;
}

/**
 * How much and when the diary is written in: days with a note, their length, the mood of those days
 * against the others, the share per mood level and the words that come up most. Counted in days, so
 * one long note cannot carry a word. Everything stays on the device.
 */
export function noteStats(days: readonly InsightDay[], texts: ReadonlyMap<DateString, string>): NoteStats {
  const withMoods: number[] = [];
  const withoutMoods: number[] = [];
  const perLevel = new Map<MoodLevel, { days: number; withNote: number }>(MOOD_LEVELS.map((level) => [level, { days: 0, withNote: 0 }]));
  const wordDays = new Map<string, number>();
  const spellings = new Map<string, Map<string, number>>();
  let total = 0;
  let longest: NoteStats['longest'] = null;

  for (const day of days) {
    const bucket = perLevel.get(day.level)!;
    bucket.days += 1;
    const text = texts.get(day.date);
    if (!text) {
      withoutMoods.push(day.mean);
      continue;
    }
    bucket.withNote += 1;
    withMoods.push(day.mean);
    const count = countWords(text);
    total += count;
    if (!longest || count > longest.words) longest = { date: day.date, words: count };
    for (const [key, raw] of words(text)) {
      wordDays.set(key, (wordDays.get(key) ?? 0) + 1);
      const forms = spellings.get(key) ?? new Map<string, number>();
      forms.set(raw, (forms.get(raw) ?? 0) + 1);
      spellings.set(key, forms);
    }
  }

  const spelling = (key: string) => [...spellings.get(key)!.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]![0];
  const top = [...wordDays.entries()]
    .filter(([, n]) => n >= MIN_TOP_WORD_DAYS)
    .map(([key, n]) => ({ key, word: spelling(key), days: n }))
    .sort((a, b) => b.days - a.days || (fold(a.word) < fold(b.word) ? -1 : 1))
    .slice(0, TOP_WORDS_SHOWN)
    .map(({ word, days: n }) => ({ word, days: n }));
  const enough = withMoods.length >= MIN_NOTE_SIDE_DAYS && withoutMoods.length >= MIN_NOTE_SIDE_DAYS;

  return {
    days: withMoods.length,
    totalDays: days.length,
    share: days.length ? withMoods.length / days.length : 0,
    words: total,
    meanWords: withMoods.length ? total / withMoods.length : null,
    withMean: enough ? mean(withMoods) : null,
    withoutMean: enough ? mean(withoutMoods) : null,
    byLevel: [...MOOD_LEVELS].reverse().map((level) => {
      const { days: n, withNote } = perLevel.get(level)!;
      return { level, days: n, withNote, share: n ? withNote / n : 0 };
    }),
    top,
    longest,
  };
}
