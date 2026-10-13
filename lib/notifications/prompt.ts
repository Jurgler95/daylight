/** The start sheet only shows on "Heute", so never over an import, a settings page or the editor. */
export const PROMPT_PATH = '/';

/** Evening time the start sheet suggests, the same as the column default. */
export const PROMPT_DEFAULT_TIME = '20:30';

export interface PromptInput {
  /** False without the native module (Expo Go): the sheet could not keep its promise. */
  available: boolean;
  reminderEnabled: boolean;
  promptDone: boolean;
  pathname: string;
}

/**
 * Whether the start sheet offers the reminder now: once, to whoever does not have it on yet, on
 * "Heute". Whoever answered it (or switched the reminder on elsewhere) is never asked again. Where
 * reminders are unavailable it stays away without counting as answered, so the installed app
 * still asks.
 */
export function shouldOfferReminder({ available, reminderEnabled, promptDone, pathname }: PromptInput): boolean {
  return available && !reminderEnabled && !promptDone && pathname === PROMPT_PATH;
}
