import type { Mood } from '@/db/schema';

/** At most five buttons, as in the mood widget and the layout of the notification. */
export const REMINDER_MOOD_SLOTS = 5;

/** What the reminder module draws its mood buttons from (`MoodButtons.kt`). */
export interface ReminderMoods {
  /** Resource name of the icon font in a release build; a Metro URL in development, which the module ignores. */
  font: string | null;
  /** The active moods in the picker's order, best first. */
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
    moods: moods.slice(0, REMINDER_MOOD_SLOTS).map((mood) => {
      const glyph = glyphs[mood.icon];
      return { id: mood.id, level: mood.level, glyph: typeof glyph === 'number' ? glyph : 0, label: mood.label };
    }),
  };
}
