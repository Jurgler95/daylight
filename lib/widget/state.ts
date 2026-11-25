import type { Mood } from '@/db/schema';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import type { StreakState } from '@/lib/streak/streak';

/** How many days back the history widget can reach: five weeks plus the rest of the oldest week. */
export const WIDGET_DAYS = 42;

export interface WidgetDay {
  level: number;
  glyph: number;
}

export interface WidgetState {
  title: string;
  /** Resource name of the icon font in a release build; a Metro URL in development, which the widget ignores. */
  font: string | null;
  /** At most five, best first, as the mood picker shows them. */
  moods: { id: number; level: number; glyph: number; label: string }[];
  /** The day the app built this for: `moodId`, `streak` and `days` hold for it. */
  date: DateString;
  moodId: number | null;
  /** Days with entries of the last `WIDGET_DAYS`, by date: the day's mood level and its icon (level 0 behind the app lock). */
  days: Record<string, WidgetDay>;
  /** 0 is Sunday, as `settings.first_day_of_week`. */
  weekStart: number;
  /** Short weekday names in the app's language, Sunday first. */
  weekdays: string[];
  streak: { days: number; todayDone: boolean; atRisk: boolean };
  /** "days in a row" for `streak.days`, and for 0 once the streak has run out unseen. */
  streakLabel: string;
  streakLabelZero: string;
  /** The quick entry widget's caption. */
  newEntry: string;
  /** App lock is on: the widgets show no moods. */
  locked: boolean;
}

export interface WidgetStateInput {
  title: string;
  font: string | null;
  moods: readonly Mood[];
  glyphs: Readonly<Record<string, number | string>>;
  date: DateString;
  moodId: number | null;
  days?: ReadonlyMap<string, { level: number; icon: string }>;
  weekStart?: number;
  weekdays?: string[];
  streak?: Pick<StreakState, 'status' | 'days' | 'todayDone'>;
  streakLabel?: string;
  streakLabelZero?: string;
  newEntry?: string;
  locked?: boolean;
}

/** What `modules/daylight-widget` draws: moods with their icon code points, today's mood, recent days and the streak. */
export function buildWidgetState(input: WidgetStateInput): WidgetState {
  const glyph = (icon: string) => {
    const value = input.glyphs[icon];
    return typeof value === 'number' ? value : 0;
  };
  const days: Record<string, WidgetDay> = {};
  if (input.days) {
    for (let back = 0; back < WIDGET_DAYS; back++) {
      const date = addDaysToDateString(input.date, -back);
      const day = input.days.get(date);
      // Behind the app lock only that a day has an entry, as level 0: the widget draws it grey.
      if (day) days[date] = input.locked ? { level: 0, glyph: 0 } : { level: day.level, glyph: glyph(day.icon) };
    }
  }
  const streak = input.streak;
  return {
    title: input.title,
    font: input.font,
    moods: input.moods.slice(0, 5).map((mood) => ({
      id: mood.id,
      level: mood.level,
      glyph: glyph(mood.icon),
      label: mood.label,
    })),
    date: input.date,
    // Behind the app lock the widgets keep to what tells nothing: no mood marked, no coloured days.
    moodId: input.locked ? null : input.moodId,
    days,
    weekStart: input.weekStart ?? 1,
    weekdays: input.weekdays ?? [],
    streak: {
      days: streak?.days ?? 0,
      todayDone: streak?.todayDone ?? false,
      atRisk: streak?.status === 'atRisk',
    },
    streakLabel: input.streakLabel ?? '',
    streakLabelZero: input.streakLabelZero ?? '',
    newEntry: input.newEntry ?? '',
    locked: input.locked ?? false,
  };
}
