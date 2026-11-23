import { gte } from 'drizzle-orm';

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

/** Notes that the hint was shown on `date`; true when that is new, false the second time on the same day. */
export function markTomorrowHint(db: Database, date: string): boolean {
  return db.insert(tomorrowHints).values({ date }).onConflictDoNothing().returning().all().length > 0;
}
