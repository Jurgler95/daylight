/**
 * An opening is a cold start, or a return to the front after the app was away at least this long.
 * Shorter trips (the fingerprint prompt of the app lock, a glance at another app) are not new visits.
 */
export const OPEN_AWAY_MS = 60_000;

export function countsAsOpen(awayMs: number): boolean {
  return awayMs >= OPEN_AWAY_MS;
}
