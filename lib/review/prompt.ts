import { toDateString, type DateString } from '@/lib/dates';

/** Days on which an entry was saved before "Heute" asks for a rating. */
export const REVIEW_USAGE_DAYS = 7;

/** The Play Store app first; without one (an APK from GitHub on a phone without Play) the web page. */
export const PLAY_STORE_URL = 'market://details?id=de.behla.daylight';
export const PLAY_WEB_URL = 'https://play.google.com/store/apps/details?id=de.behla.daylight';

/**
 * Local days on which entries were saved, from their `created_at` timestamps. Counted by when an
 * entry was written, not by the day it is about: a CSV import, the sample data or seven days filled
 * in at one sitting are one day of use. A restored JSON backup keeps its timestamps and so its days.
 */
export function usageDays(createdAt: Iterable<string>): number {
  const days = new Set<DateString>();
  for (const stamp of createdAt) {
    const date = new Date(stamp);
    if (!Number.isNaN(date.getTime())) days.add(toDateString(date));
  }
  return days.size;
}

export interface ReviewPromptInput {
  /** `created_at` of every entry. */
  createdAt: Iterable<string>;
  /** "Bewerten" or "Nicht jetzt" was tapped once. */
  done: boolean;
}

/** Whether a save may bring up the card: seven days of use and never answered. */
export function reviewPromptDue({ createdAt, done }: ReviewPromptInput): boolean {
  return !done && usageDays(createdAt) >= REVIEW_USAGE_DAYS;
}

/**
 * Opens Daylight in the Play Store app, else on the web. A plain intent, no Play library. Resolves
 * false when neither opens; never throws, so the button cannot crash on a phone without either.
 */
export async function openPlayStore(open: (url: string) => Promise<unknown>): Promise<boolean> {
  for (const url of [PLAY_STORE_URL, PLAY_WEB_URL]) {
    try {
      await open(url);
      return true;
    } catch {
      // No app for this link; try the next one.
    }
  }
  return false;
}
