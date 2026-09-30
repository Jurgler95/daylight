import { asc, eq, max } from 'drizzle-orm';

import { fold } from '@/lib/search/fold';

import { scales, type Scale } from '../schema';
import { NameTakenError, RepositoryError, type Database } from '../types';
import { assertName } from '../validate';

export function listScales(db: Database, options: { includeArchived?: boolean } = {}): Scale[] {
  return db
    .select()
    .from(scales)
    .where(options.includeArchived ? undefined : eq(scales.archived, false))
    .orderBy(asc(scales.sort_order), asc(scales.id))
    .all();
}

/** Returns the existing scale when the folded name is already taken. */
export function createScale(db: Database, input: { name: string; min?: number; max?: number }): Scale {
  const name = assertName(input.name);
  const existing = listScales(db, { includeArchived: true }).find((scale) => fold(scale.name) === fold(name));
  if (existing) return existing;
  const min = input.min ?? 0;
  const maxValue = input.max ?? 10;
  if (!Number.isInteger(min) || !Number.isInteger(maxValue) || min >= maxValue) throw new RepositoryError('scale needs integer min < max');
  const last = db.select({ value: max(scales.sort_order) }).from(scales).get()?.value ?? -1;
  return db.insert(scales).values({ name, min, max: maxValue, sort_order: last + 1 }).returning().get();
}

/** Renames or archives a scale. Its range stays as created, so stored values always fit it. */
export function updateScale(db: Database, id: number, patch: Partial<Pick<Scale, 'name' | 'sort_order' | 'archived'>>): Scale {
  const clean = { ...patch };
  if (clean.name !== undefined) {
    const name = assertName(clean.name);
    clean.name = name;
    const other = listScales(db, { includeArchived: true }).find((scale) => fold(scale.name) === fold(name));
    if (other && other.id !== id) throw new NameTakenError(name);
  }
  return db.update(scales).set(clean).where(eq(scales.id, id)).returning().get();
}
