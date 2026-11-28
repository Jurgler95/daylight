import type { Mood } from '@/db/schema';

/** At most five buttons, as in the mood widget and the layout of the notification. */
export const REMINDER_MOOD_SLOTS = 5;

/**
 * One button per level, best first: the first mood of each level in the picker's order. Several moods
 * of one level (say "Good" and "Gut" after an import) never push the bad days off the five buttons.
 */
export function onePerLevel<T extends Pick<Mood, 'level'>>(moods: readonly T[]): T[] {
  const seen = new Set<number>();
  const first = moods.filter((mood) => !seen.has(mood.level) && seen.add(mood.level));
  return first.sort((a, b) => b.level - a.level).slice(0, REMINDER_MOOD_SLOTS);
}

/** What the reminder module draws its mood buttons from (`MoodButtons.kt`). */
export interface ReminderMoods {
  /** Resource name of the icon font in a release build; a Metro URL in development, which the module ignores. */
  font: string | null;
  /** One active mood per level, best first (`onePerLevel`). */
  moods: { id: number; level: number; glyph: number; label: string }[];
}

/**
 * The buttons for `moods` (`catalog.moods`: active only, in the app's order). Never which mood was
 * chosen last: the notification may sit on the lock screen, also with the app lock on.
 */
export function buildReminderMoods(
  moods: readonly Pick<Mood, 'id' | 'level' | 'icon' | 'label'>[],
  glyphs: Readonly<Record<string, number | string>>,
  font: string | null,
): ReminderMoods {
  return {
    font,
    moods: onePerLevel(moods).map((mood) => {
      const glyph = glyphs[mood.icon];
      return { id: mood.id, level: mood.level, glyph: typeof glyph === 'number' ? glyph : 0, label: mood.label };
    }),
  };
}
