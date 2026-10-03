import { totalStars, type Achievement, type AchievementKey } from './achievements';

/** Stars per achievement that were already announced. A key missing counts as none. */
export type SeenStars = Partial<Record<AchievementKey, number>>;

export type StarNews =
  /** Achievements came with this version and the diary already holds stars: say hello once. */
  | { kind: 'welcome'; stars: number }
  /** New stars since the last announcement, the achievement with the most new stars first. */
  | { kind: 'stars'; earned: { achievement: Achievement; from: number }[]; count: number };

export function parseSeen(text: string | null | undefined): SeenStars | null {
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as SeenStars) : null;
  } catch {
    return null;
  }
}

export function seenOf(achievements: readonly Achievement[]): SeenStars {
  return Object.fromEntries(achievements.map((achievement) => [achievement.key, achievement.stars]));
}

/** What to announce, or null when nothing is new. `seen` null means nothing was ever checked. */
export function starNews(achievements: readonly Achievement[], seen: SeenStars | null): StarNews | null {
  if (seen === null) {
    const stars = totalStars(achievements);
    return stars > 0 ? { kind: 'welcome', stars } : null;
  }
  const earned = achievements
    .map((achievement) => ({ achievement, from: seen[achievement.key] ?? 0 }))
    .filter(({ achievement, from }) => achievement.stars > from)
    .sort((a, b) => b.achievement.stars - b.from - (a.achievement.stars - a.from));
  if (earned.length === 0) return null;
  return { kind: 'stars', earned, count: earned.reduce((sum, { achievement, from }) => sum + achievement.stars - from, 0) };
}

/**
 * What to store without announcing anything: the first check of an empty diary, and stars that went
 * away (an entry deleted, all data deleted), so earning them again is news again. Null when the
 * stored value is right as it is.
 */
export function quietSeen(achievements: readonly Achievement[], seen: SeenStars | null): SeenStars | null {
  if (seen === null) return totalStars(achievements) === 0 ? seenOf(achievements) : null;
  let changed = false;
  const next: SeenStars = { ...seen };
  for (const achievement of achievements) {
    const before = seen[achievement.key];
    if (before !== undefined && achievement.stars < before) {
      next[achievement.key] = achievement.stars;
      changed = true;
    }
  }
  return changed ? next : null;
}
