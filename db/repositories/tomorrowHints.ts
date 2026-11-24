import { and, eq, gte, isNotNull } from 'drizzle-orm';

import { tomorrowHints } from '../schema';
import type { Database } from '../types';

/** Days from `from` on (as `YYYY-MM-DD`) on which the hint for a good next day was shown, oldest first. */
export function listTomorrowHints(db: Database, from: string): string[] {
  return db
    .select()
    .from(tomorrowHints)
    .where(gte(tomorrowHints.date, from))
    .all()
    .map((row) => row.date)
    .sort();
}

/** Days from `from` on whose hint is still stored, with it as JSON. */
export function listTomorrowSnapshots(db: Database, from: string): Map<string, string> {
  const rows = db
    .select()
    .from(tomorrowHints)
    .where(and(gte(tomorrowHints.date, from), isNotNull(tomorrowHints.hint)))
    .all();
  return new Map(rows.map((row) => [row.date, row.hint!]));
}

/**
 * Notes that the hint was shown on `date`, as `hint` (JSON), or updates it when it changed while
 * still on screen. True when anything changed: a new day, or a hint that reads differently now.
 */
export function markTomorrowHint(db: Database, date: string, hint: string): boolean {
  const row = db.select().from(tomorrowHints).where(eq(tomorrowHints.date, date)).get();
  if (row?.hint === hint) return false;
  db.insert(tomorrowHints).values({ date, hint }).onConflictDoUpdate({ target: tomorrowHints.date, set: { hint } }).run();
  return true;
}

/** Forgets the stored hint of `date` (it no longer holds), keeping the day counted. True when there was one. */
export function clearTomorrowHint(db: Database, date: string): boolean {
  return (
    db
      .update(tomorrowHints)
      .set({ hint: null })
      .where(and(eq(tomorrowHints.date, date), isNotNull(tomorrowHints.hint)))
      .returning()
      .all().length > 0
  );
}
