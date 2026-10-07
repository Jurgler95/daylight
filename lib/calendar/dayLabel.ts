import type { MoodLevel } from '@/db/schema';
import type { DateString } from '@/lib/dates';
import type { IconName } from '@/lib/icons';

/** What a calendar day shows. Kept here so the spoken label and the drawing agree. */
export interface DayMarker {
  /** Rounded mean of the day's entries. */
  level: MoodLevel;
  /** Mood icon drawn in the day, so the colour never carries the meaning alone. */
  icon: IconName;
  /** Number of entries; more than one adds a small dot. */
  count: number;
  /** The day is a turning point; drawn as a small flag. */
  turning?: boolean;
}

/**
 * A future day with something to show: the outlook's expected level as a hollow ring (only where
 * the backtest let the outlook through) and the icons of planned activities.
 */
export interface AheadMarker {
  /** The level of the outlook's middle and the icon it is drawn with, so the ring is not colour alone. */
  outlook: { level: MoodLevel; icon: IconName } | null;
  planned: readonly { icon: IconName; name: string }[];
}

export type CalendarMarker = DayMarker | AheadMarker;

export function isAhead(marker: CalendarMarker | undefined): marker is AheadMarker {
  return marker !== undefined && 'planned' in marker;
}

export interface DayLabelTexts {
  today: string;
  /** Name of the mood a level is drawn as, e.g. "Gut". */
  mood: (level: MoodLevel) => string;
  /** "2 Einträge". */
  entries: (count: number) => string;
  noEntry: string;
  formatDate: (date: DateString) => string;
  /** "Ausblick Gut". */
  outlook: (level: MoodLevel) => string;
  /** "geplant: Familie, Arbeit". */
  planned: (names: string) => string;
  /** "Wendepunkt". */
  turning: string;
}

/**
 * Screen readers get the same information the drawing carries, in reading order.
 * Example: "Freitag, 25. September, Heute, Gut, 2 Einträge". Future days never say "kein Eintrag";
 * they name the outlook and the plans instead: "Samstag, 3. Oktober, Ausblick Gut, geplant: Familie".
 */
export function dayAccessibilityLabel(
  date: DateString,
  marker: CalendarMarker | undefined,
  isToday: boolean,
  isFuture: boolean,
  texts: DayLabelTexts,
): string {
  const parts = [texts.formatDate(date)];
  if (isToday) parts.push(texts.today);
  if (isAhead(marker)) {
    if (marker.outlook) parts.push(texts.outlook(marker.outlook.level));
    if (marker.planned.length) parts.push(texts.planned(marker.planned.map((p) => p.name).join(', ')));
  } else if (marker) {
    parts.push(texts.mood(marker.level));
    if (marker.count > 1) parts.push(texts.entries(marker.count));
    if (marker.turning) parts.push(texts.turning);
  } else if (!isFuture) parts.push(texts.noEntry);
  return parts.join(', ');
}
