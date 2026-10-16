import { CONTENT, type ContentLanguage } from '@/lib/i18n/content';

import type { SampleData } from './generateSample';

/** German name or sentence to its translation; anything missing stays German. */
export interface SampleTranslation {
  moods: Record<string, string>;
  activities: Record<string, string>;
  titles: Record<string, string>;
  sentences: Record<string, string>;
  scale: string;
}

const GERMAN_MOODS = ['Super', 'Gut', 'Ok', 'Schlecht', 'Mies'] as const;

/** The sample translation of a language from `lib/i18n/content`. */
export function contentTranslation(language: ContentLanguage): SampleTranslation {
  const { moods, activities, sample } = CONTENT[language];
  return {
    moods: Object.fromEntries(GERMAN_MOODS.map((german, index) => [german, moods[index]!])),
    activities,
    titles: sample.titles,
    sentences: sample.sentences,
    scale: sample.scale,
  };
}

/**
 * The generator stays German, so seeds and tests are the same in every language; this maps every
 * name and every note sentence afterwards. Longest sentence first, so none is replaced inside a longer one.
 */
export function translateSample(data: SampleData, translation: SampleTranslation): SampleData {
  const order = Object.keys(translation.sentences).sort((a, b) => b.length - a.length);
  const note = (text: string) => order.reduce((result, german) => result.split(german).join(translation.sentences[german]!), text);
  const activity = (name: string) => translation.activities[name] ?? name;
  return {
    entries: data.entries.map((entry) => ({
      ...entry,
      mood: translation.moods[entry.mood] ?? entry.mood,
      activities: entry.activities.map(activity),
      scales: entry.scales.map((scale) => ({ ...scale, name: translation.scale })),
      noteTitle: entry.noteTitle === null ? null : (translation.titles[entry.noteTitle] ?? entry.noteTitle),
      note: entry.note === null ? null : note(entry.note),
    })),
    plans: data.plans.map((plan) => ({ ...plan, activity: activity(plan.activity) })),
  };
}
