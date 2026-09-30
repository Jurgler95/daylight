import type { InsightDay } from './days';
import { mean } from './stats';

/** Days with the activity, in the window and in the one before. */
export interface ActivityCount {
  activityId: number;
  days: number;
  /** Null without a comparable window before. */
  previousDays: number | null;
}

/** How many days each activity was on, most frequent first. Activities never used in the window but used before are kept with 0. */
export function activityCounts(days: readonly InsightDay[], previous: readonly InsightDay[] | null): ActivityCount[] {
  const count = (list: readonly InsightDay[]) => {
    const counts = new Map<number, number>();
    for (const day of list) for (const id of day.activities) counts.set(id, (counts.get(id) ?? 0) + 1);
    return counts;
  };
  const now = count(days);
  const before = previous ? count(previous) : null;
  const ids = new Set([...now.keys(), ...(before?.keys() ?? [])]);
  return [...ids]
    .map((activityId) => ({ activityId, days: now.get(activityId) ?? 0, previousDays: before ? (before.get(activityId) ?? 0) : null }))
    .sort((a, b) => b.days - a.days || a.activityId - b.activityId);
}

/** Pairs need this many shared days. */
export const MIN_PAIR_DAYS = 5;
/** And must come together at least this much more often than chance would have it. */
export const MIN_PAIR_LIFT = 1.2;

export interface ActivityPair {
  a: number;
  b: number;
  /** Days with both. */
  together: number;
  /**
   * How much more often both came together than if they were unrelated:
   * together · days / (days with a · days with b).
   */
  lift: number;
  /** Mean mood on the days with both. */
  mean: number;
}

/** Activities that tend to come together, strongest lift first; `a` has the smaller id. */
export function activityPairs(days: readonly InsightDay[], minTogether: number = MIN_PAIR_DAYS, minLift: number = MIN_PAIR_LIFT): ActivityPair[] {
  const single = new Map<number, number>();
  const joint = new Map<string, number[]>();
  for (const day of days) {
    const ids = [...day.activities].sort((x, y) => x - y);
    for (let i = 0; i < ids.length; i++) {
      single.set(ids[i]!, (single.get(ids[i]!) ?? 0) + 1);
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}:${ids[j]}`;
        const list = joint.get(key);
        if (list) list.push(day.mean);
        else joint.set(key, [day.mean]);
      }
    }
  }
  const pairs: ActivityPair[] = [];
  for (const [key, moods] of joint) {
    if (moods.length < minTogether) continue;
    const [a, b] = key.split(':').map(Number) as [number, number];
    const lift = (moods.length * days.length) / (single.get(a)! * single.get(b)!);
    if (lift < minLift) continue;
    pairs.push({ a, b, together: moods.length, lift, mean: mean(moods)! });
  }
  return pairs.sort((x, y) => y.lift - x.lift || y.together - x.together || x.a - y.a || x.b - y.b);
}

/** A group's activities need this many days before their mean is shown. */
export const MIN_GROUP_ROW_DAYS = 3;

export interface GroupRow {
  /** Null is the row for days with none of the group's activities. */
  activityId: number | null;
  days: number;
  /** Null below `MIN_GROUP_ROW_DAYS`. */
  mean: number | null;
}

/**
 * Mood per activity of one group (weather, sleep), in the order given, plus a row for the days
 * that have none of them. Activities without a single day are left out.
 */
export function groupRows(days: readonly InsightDay[], activityIds: readonly number[]): GroupRow[] {
  const moods = new Map<number | null, number[]>();
  const push = (key: number | null, value: number) => {
    const list = moods.get(key);
    if (list) list.push(value);
    else moods.set(key, [value]);
  };
  for (const day of days) {
    let any = false;
    for (const id of activityIds) {
      if (!day.activities.has(id)) continue;
      any = true;
      push(id, day.mean);
    }
    if (!any) push(null, day.mean);
  }
  return [...activityIds, null].flatMap((activityId) => {
    const values = moods.get(activityId);
    if (!values) return [];
    return [{ activityId, days: values.length, mean: values.length >= MIN_GROUP_ROW_DAYS ? mean(values) : null }];
  });
}
