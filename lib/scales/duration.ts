/** A duration scale holds minutes of one day, entered in quarter hours. */
export const DURATION_MAX_MINUTES = 24 * 60;
export const DURATION_STEP_MINUTES = 15;
/** One tap for the usual amounts: half an hour up to a working day. */
export const DURATION_PRESETS = [30, 60, 120, 240, 480] as const;
