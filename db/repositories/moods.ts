import { and, asc, count, eq, max, ne } from 'drizzle-orm';

import { moodIconForLevel } from '@/lib/daylio/known';

import { entries, moods, type Mood } from '../schema';
import { LastMoodError, type Database } from '../types';
import { assertLevel, assertName } from '../validate';

export function listMoods(db: Database, options: { includeArchived?: boolean } = {}): Mood[] {
  return db
    .select()
    .from(moods)
    .where(options.includeArchived ? undefined : eq(moods.archived, false))
    .orderBy(asc(moods.sort_order), asc(moods.id))
    .all();
}

export function getMood(db: Database, id: number): Mood | undefined {
  return db.select().from(moods).where(eq(moods.id, id)).get();
}

/** New moods go to the end of the list and take the standard icon of their level unless given one. */
export function createMood(db: Database, input: { label: string; level: number; icon?: string; sort_order?: number }): Mood {
  const level = assertLevel(input.level);
  const last = db.select({ value: max(moods.sort_order) }).from(moods).get()?.value ?? -1;
  return db
    .insert(moods)
    .values({
      label: assertName(input.label, 'label'),
      level,
      icon: input.icon ?? moodIconForLevel(level),
      sort_order: input.sort_order ?? last + 1,
    })
    .returning()
    .get();
}

/** Throws `LastMoodError` when archiving would leave nothing to pick in the editor. */
export function updateMood(db: Database, id: number, patch: Partial<Pick<Mood, 'label' | 'level' | 'icon' | 'sort_order' | 'archived'>>): Mood {
  const clean = { ...patch };
  if (clean.label !== undefined) clean.label = assertName(clean.label, 'label');
  if (clean.level !== undefined) clean.level = assertLevel(clean.level);
  if (clean.archived) {
    const others = db.select({ n: count() }).from(moods).where(and(eq(moods.archived, false), ne(moods.id, id))).get()?.n ?? 0;
    if (others === 0) throw new LastMoodError('at least one mood has to stay');
  }
  return db.update(moods).set(clean).where(eq(moods.id, id)).returning().get();
}

/** How many entries use each mood. Moods without any are absent. */
export function moodUsage(db: Database): Map<number, number> {
  const rows = db.select({ id: entries.mood_id, n: count() }).from(entries).groupBy(entries.mood_id).all();
  return new Map(rows.map((row) => [row.id, row.n]));
}
