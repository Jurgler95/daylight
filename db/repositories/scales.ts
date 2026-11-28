import { asc, eq, max } from 'drizzle-orm';

import { DURATION_MAX_MINUTES } from '@/lib/scales/duration';
import { clampDecimals, cleanUnit } from '@/lib/scales/number';
import { fold } from '@/lib/search/fold';

import { scales, type Scale, type ScaleKind } from '../schema';
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

/**
 * Returns the existing scale when the folded name is already taken. A duration always spans 0 to
 * a full day in minutes, whatever range is passed. A number has no range (stored as 0 to 0), only
 * a unit and 0 to 2 decimals.
 */
export function createScale(
  db: Database,
  input: { name: string; min?: number; max?: number; kind?: ScaleKind; unit?: string; decimals?: number },
): Scale {
  const name = assertName(input.name);
  const existing = listScales(db, { includeArchived: true }).find((scale) => fold(scale.name) === fold(name));
  if (existing) return existing;
  const kind = input.kind ?? 'rating';
  const last = db.select({ value: max(scales.sort_order) }).from(scales).get()?.value ?? -1;
  if (kind === 'number') {
    const values = { name, min: 0, max: 0, kind, unit: cleanUnit(input.unit ?? ''), decimals: clampDecimals(input.decimals ?? 0), sort_order: last + 1 };
    return db.insert(scales).values(values).returning().get();
  }
  const min = kind === 'duration' ? 0 : (input.min ?? 0);
  const maxValue = kind === 'duration' ? DURATION_MAX_MINUTES : (input.max ?? 10);
  if (!Number.isInteger(min) || !Number.isInteger(maxValue) || min >= maxValue) throw new RepositoryError('scale needs integer min < max');
  return db.insert(scales).values({ name, min, max: maxValue, kind, sort_order: last + 1 }).returning().get();
}

/**
 * Renames, archives or marks a scale, or changes a number scale's unit and decimals. A rating's range
 * stays as created, so stored values always fit it. Fewer decimals only show stored values rounded.
 */
export function updateScale(db: Database, id: number, patch: Partial<Pick<Scale, 'name' | 'sort_order' | 'archived' | 'unit' | 'decimals' | 'describes_mood'>>): Scale {
  const clean = { ...patch };
  if (clean.unit !== undefined) clean.unit = cleanUnit(clean.unit);
  if (clean.decimals !== undefined) clean.decimals = clampDecimals(clean.decimals);
  if (clean.name !== undefined) {
    const name = assertName(clean.name);
    clean.name = name;
    const other = listScales(db, { includeArchived: true }).find((scale) => fold(scale.name) === fold(name));
    if (other && other.id !== id) throw new NameTakenError(name);
  }
  return db.update(scales).set(clean).where(eq(scales.id, id)).returning().get();
}
