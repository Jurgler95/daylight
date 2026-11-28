import { eq, inArray } from 'drizzle-orm';

import { activityName, groupName, isStandardMood, standardActivityKey, standardGroupKey, standardMoodLabel } from '@/lib/daylio/known';
import type { ActivityKey, GroupKey } from '@/lib/i18n/content';
import { currentLanguage, type Language } from '@/lib/i18n/language';
import { fold } from '@/lib/search/fold';

import { activities, activityGroups, entries, moods, type Activity, type ActivityGroup, type Mood, type MoodLevel } from '../schema';
import type { Database } from '../types';
import { mergeActivities } from './activities';

/**
 * Keeps the moods, groups and activities the app brought in the app's language and each of them
 * once. A row counts as standard while its name is still the app's name for its slot in one of its
 * languages (`lib/daylio/known.ts`); renamed rows are the user's own and stay as they are.
 *
 * - Several standard moods of one level (a backup from a journal in another language) become one:
 *   their entries move to the one kept, the others go. Same for standard groups (their activities
 *   move over) and for standard activities inside a standard group (entry links and plans move over).
 * - What is left is renamed to `language`.
 *
 * Cheap and idempotent: it reads three small tables and writes only what is off. Runs on every
 * start, after a language switch and after an import. Expects to run inside a transaction.
 */
export function tidyStandards(tx: Database, language: Language = currentLanguage()): void {
  tidyMoods(tx, language);
  tidyGroups(tx, language);
  tidyActivities(tx, language);
}

/** Active first, then the one already named in `language`, then the one further up the list. */
function keeperFirst<T extends { id: number; sort_order: number; archived: boolean }>(rows: readonly T[], name: (row: T) => string, target: string): T[] {
  return [...rows].sort(
    (a, b) =>
      Number(a.archived) - Number(b.archived) ||
      Number(name(a) !== target) - Number(name(b) !== target) ||
      a.sort_order - b.sort_order ||
      a.id - b.id,
  );
}

function bySlot<T, K>(rows: readonly T[], slot: (row: T) => K | null): Map<K, T[]> {
  const slots = new Map<K, T[]>();
  for (const row of rows) {
    const key = slot(row);
    if (key === null) continue;
    slots.set(key, [...(slots.get(key) ?? []), row]);
  }
  return slots;
}

function tidyMoods(tx: Database, language: Language): void {
  const rows = tx.select().from(moods).all();
  const slots = bySlot<Mood, MoodLevel>(rows, (mood) => (isStandardMood(mood.label, mood.level) ? (mood.level as MoodLevel) : null));
  for (const [level, standard] of slots) {
    const label = standardMoodLabel(level, language);
    const [keep, ...others] = keeperFirst(standard, (mood) => mood.label, label);
    if (!keep) continue;
    if (others.length > 0) {
      const ids = others.map((mood) => mood.id);
      tx.update(entries).set({ mood_id: keep.id }).where(inArray(entries.mood_id, ids)).run();
      tx.delete(moods).where(inArray(moods.id, ids)).run();
    }
    if (keep.label !== label) tx.update(moods).set({ label }).where(eq(moods.id, keep.id)).run();
  }
}

function tidyGroups(tx: Database, language: Language): void {
  const groups = tx.select().from(activityGroups).all();
  const slots = bySlot<ActivityGroup, GroupKey>(groups, (group) => standardGroupKey(group.name));
  for (const [key, standard] of slots) {
    const name = groupName(key, language);
    const [keep, ...others] = keeperFirst(standard, (group) => group.name, name);
    if (!keep) continue;
    for (const other of others) {
      const kept = tx.select().from(activities).where(eq(activities.group_id, keep.id)).all();
      let order = kept.reduce((max, activity) => Math.max(max, activity.sort_order), -1) + 1;
      const moving = tx.select().from(activities).where(eq(activities.group_id, other.id)).all();
      for (const activity of [...moving].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)) {
        const slot = standardActivityKey(activity.name, key);
        const twin = kept.find((candidate) => fold(candidate.name) === fold(activity.name) || (slot !== null && standardActivityKey(candidate.name, key) === slot));
        if (twin) {
          mergeActivities(tx, activity.id, twin.id);
          continue;
        }
        tx.update(activities).set({ group_id: keep.id, sort_order: order++ }).where(eq(activities.id, activity.id)).run();
        kept.push({ ...activity, group_id: keep.id });
      }
      tx.delete(activityGroups).where(eq(activityGroups.id, other.id)).run();
    }
    const taken = groups.some((group) => group.id !== keep.id && !others.includes(group) && fold(group.name) === fold(name));
    if (keep.name !== name && !taken) tx.update(activityGroups).set({ name }).where(eq(activityGroups.id, keep.id)).run();
  }
}

function tidyActivities(tx: Database, language: Language): void {
  for (const group of tx.select().from(activityGroups).all()) {
    const key = standardGroupKey(group.name);
    if (key === null || key === 'imported') continue;
    const rows = tx.select().from(activities).where(eq(activities.group_id, group.id)).all();
    const slots = bySlot<Activity, ActivityKey>(rows, (activity) => standardActivityKey(activity.name, key));
    for (const [slot, standard] of slots) {
      const name = activityName(slot, language);
      const [keep, ...others] = keeperFirst(standard, (activity) => activity.name, name);
      if (!keep) continue;
      for (const other of others) mergeActivities(tx, other.id, keep.id);
      // The unique index on group and name: never rename onto an activity of the user's own.
      const taken = rows.some((activity) => activity.id !== keep.id && !others.includes(activity) && fold(activity.name) === fold(name));
      if (keep.name !== name && !taken) tx.update(activities).set({ name }).where(eq(activities.id, keep.id)).run();
    }
  }
}
