import { asc, eq } from 'drizzle-orm';

import { roomInYear, TURNING_POINTS_PER_YEAR, yearOf } from '@/lib/turning/rules';

import { entries, turningPoints, type TurningPoint } from '../schema';
import { RepositoryError, type Database } from '../types';
import { assertDate, assertName, now, optionalText } from '../validate';

/** The year of the date already holds `TURNING_POINTS_PER_YEAR` turning points. */
export class TurningPointLimitError extends RepositoryError {
  override readonly name: string = 'TurningPointLimitError';
  constructor(readonly year: string) {
    super(`${year} already has ${TURNING_POINTS_PER_YEAR} turning points`);
  }
}

/** Oldest first. */
export function listTurningPoints(db: Database): TurningPoint[] {
  return db.select().from(turningPoints).orderBy(asc(turningPoints.date)).all();
}

export function getTurningPoint(db: Database, id: number): TurningPoint | undefined {
  return db.select().from(turningPoints).where(eq(turningPoints.id, id)).get();
}

export function turningPointOn(db: Database, date: string): TurningPoint | undefined {
  return db.select().from(turningPoints).where(eq(turningPoints.date, date)).get();
}

/**
 * A turning point hangs on a day of the diary: the day needs an entry, so there is something to
 * compare and nothing is ever set in the future.
 */
export function createTurningPoint(db: Database, input: { date: string; title: string; note?: string | null }): TurningPoint {
  const date = assertDate(input.date);
  const title = assertName(input.title, 'title');
  return db.transaction((tx) => {
    if (!tx.select({ id: entries.id }).from(entries).where(eq(entries.date, date)).get()) throw new RepositoryError(`${date} has no entry`);
    if (turningPointOn(tx, date)) throw new RepositoryError(`${date} already is a turning point`);
    if (roomInYear(listTurningPoints(tx).map((point) => point.date), date) === 0) throw new TurningPointLimitError(yearOf(date));
    return tx.insert(turningPoints).values({ date, title, note: optionalText(input.note?.trim()) }).returning().get();
  });
}

/** Title and note only; the date stays, so the cap is checked once, on creation. */
export function updateTurningPoint(db: Database, id: number, patch: { title?: string; note?: string | null }): TurningPoint {
  const clean: Partial<TurningPoint> = { updated_at: now() };
  if (patch.title !== undefined) clean.title = assertName(patch.title, 'title');
  if (patch.note !== undefined) clean.note = optionalText(patch.note?.trim());
  const updated = db.update(turningPoints).set(clean).where(eq(turningPoints.id, id)).returning().get();
  if (!updated) throw new RepositoryError(`turning point ${id} not found`);
  return updated;
}

export function deleteTurningPoint(db: Database, id: number): void {
  db.delete(turningPoints).where(eq(turningPoints.id, id)).run();
}
