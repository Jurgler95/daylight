import type { Activity, ActivityGroup, Mood, MoodLevel, Scale } from '@/db/schema';
import { DEFAULT_MOODS, moodIconForLevel } from '@/lib/daylio/known';
import type { IconName } from '@/lib/icons';
import { fold } from '@/lib/search/fold';

/** Moods, groups, activities and scales as every screen reads them, with lookups by id. */
export interface Catalog {
  /** Active moods, best level first, then in their own order. The mood picker shows these. */
  moods: Mood[];
  /** Every mood, archived ones included, so old entries still find theirs. */
  moodById: ReadonlyMap<number, Mood>;
  /** Active groups in display order. */
  groups: ActivityGroup[];
  /** Every activity in display order, archived ones included. */
  activities: Activity[];
  activityById: ReadonlyMap<number, Activity>;
  /** Active scales in display order. */
  scales: Scale[];
  scaleById: ReadonlyMap<number, Scale>;
}

export function buildCatalog(input: { moods: Mood[]; groups: ActivityGroup[]; activities: Activity[]; scales: Scale[] }): Catalog {
  return {
    moods: input.moods.filter((mood) => !mood.archived).sort((a, b) => b.level - a.level || a.sort_order - b.sort_order || a.id - b.id),
    moodById: new Map(input.moods.map((mood) => [mood.id, mood])),
    groups: input.groups.filter((group) => !group.archived),
    activities: input.activities,
    activityById: new Map(input.activities.map((activity) => [activity.id, activity])),
    scales: input.scales.filter((scale) => !scale.archived),
    scaleById: new Map(input.scales.map((scale) => [scale.id, scale])),
  };
}

/** The first active mood on the level stands for it; without one, the standard mood of that level. */
export function levelMood(catalog: Catalog, level: MoodLevel): { label: string; icon: IconName } {
  const mood = catalog.moods.find((candidate) => candidate.level === level);
  if (mood) return { label: mood.label, icon: mood.icon as IconName };
  const fallback = DEFAULT_MOODS.find((candidate) => candidate.level === level);
  return { label: fallback?.label ?? String(level), icon: moodIconForLevel(level) };
}

export interface GroupWithActivities {
  group: ActivityGroup;
  activities: Activity[];
}

/**
 * Active groups with the activities the editor offers: active ones, plus archived ones or ones in
 * an archived group that are set on this entry, so they can still be taken off.
 */
export function editorGroups(catalog: Catalog, selected: readonly number[]): GroupWithActivities[] {
  const groups = catalog.groups.map((group) => ({
    group,
    activities: catalog.activities.filter((activity) => activity.group_id === group.id && (!activity.archived || selected.includes(activity.id))),
  }));
  const active = new Set(catalog.groups.map((group) => group.id));
  const stray = catalog.activities.filter((activity) => selected.includes(activity.id) && !active.has(activity.group_id));
  const last = groups[groups.length - 1];
  if (stray.length && last) last.activities.push(...stray);
  return groups;
}

const ambiguousNames = new WeakMap<Catalog, Set<string>>();

/**
 * An activity's name, followed by its group when the name alone is ambiguous: another activity or
 * a mood carries the same folded name, like "Schlecht" for sleep next to the mood "Schlecht".
 * The insights name activities outside their group, where this matters.
 */
export function activityLabel(catalog: Catalog, id: number): string {
  const activity = catalog.activityById.get(id);
  if (!activity) return '';
  let ambiguous = ambiguousNames.get(catalog);
  if (!ambiguous) {
    const seen = new Set(catalog.moods.map((mood) => fold(mood.label)));
    ambiguous = new Set<string>();
    for (const other of catalog.activities) {
      const key = fold(other.name);
      if (seen.has(key)) ambiguous.add(key);
      seen.add(key);
    }
    ambiguousNames.set(catalog, ambiguous);
  }
  const group = catalog.groups.find((candidate) => candidate.id === activity.group_id);
  return ambiguous.has(fold(activity.name)) && group ? `${activity.name} (${group.name})` : activity.name;
}
