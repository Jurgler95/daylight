import { and, asc, count, gte, lte, min } from 'drizzle-orm';

import type { DateString } from '@/lib/dates';

import { healthDays, type HealthDay } from '../schema';
import type { Database } from '../types';
import { assertDate, now } from '../validate';

export type HealthValues = Omit<HealthDay, 'date' | 'synced_at'>;

export interface HealthDayInput extends HealthValues {
  date: string;
}

function hasAnyValue(day: HealthValues): boolean {
  return day.steps !== null || day.sleep_minutes !== null || day.resting_hr !== null || day.exercise_minutes !== null;
}

/**
 * Writes what one sync read for the days `from`..`to`: every day in the range is replaced, and a day
 * Health Connect has nothing for any more is removed. So a sync can be repeated as often as needed.
 */
export function replaceHealthDays(db: Database, from: string, to: string, days: readonly HealthDayInput[]): void {
  const start = assertDate(from, 'from');
  const end = assertDate(to, 'to');
  const syncedAt = now();
  db.transaction((tx) => {
    tx.delete(healthDays).where(and(gte(healthDays.date, start), lte(healthDays.date, end))).run();
    const rows = days
      .filter((day) => day.date >= start && day.date <= end && hasAnyValue(day))
      .map((day) => ({ ...day, date: assertDate(day.date, 'date'), synced_at: syncedAt }));
    // SQLite caps the variables of one statement, and a backfill writes a month at a time.
    for (let i = 0; i < rows.length; i += 100) tx.insert(healthDays).values(rows.slice(i, i + 100)).run();
  });
}

export function listHealthDays(db: Database, from?: string, to?: string): HealthDay[] {
  return db
    .select()
    .from(healthDays)
    .where(and(from ? gte(healthDays.date, from) : undefined, to ? lte(healthDays.date, to) : undefined))
    .orderBy(asc(healthDays.date))
    .all();
}

export function firstHealthDate(db: Database): DateString | null {
  const row = db.select({ value: min(healthDays.date) }).from(healthDays).get();
  return (row?.value as DateString | null | undefined) ?? null;
}

export function countHealthDays(db: Database): number {
  return db.select({ n: count() }).from(healthDays).get()?.n ?? 0;
}

export function clearHealthDays(db: Database): void {
  db.delete(healthDays).run();
}
