import type { DateString } from '@/lib/dates';
import { isStarterActivity } from '@/lib/daylio/known';

import { buildAchievements, type AchievementEntry } from '../achievements';
import { parseSeen, quietSeen, seenOf, starNews } from '../news';

const today = '2026-10-03' as DateString;
const entry = (date: string): AchievementEntry => ({ date, activity_ids: [], photos: [], scales: [] });
const build = (entries: AchievementEntry[]) =>
  buildAchievements({ entries, health: [], activities: [], isStarter: isStarterActivity, opens: 0, turningPoints: 0, today, firstDayOfWeek: 1 });

const empty = build([]);
const one = build([entry('2026-10-03')]);

describe('parseSeen', () => {
  it('reads an object and gives null for nothing or garbage', () => {
    expect(parseSeen('{"days":2}')).toEqual({ days: 2 });
    expect(parseSeen(null)).toBeNull();
    expect(parseSeen('[1]')).toBeNull();
    expect(parseSeen('{')).toBeNull();
  });
});

describe('starNews', () => {
  it('stays quiet for an empty diary on the first check and stores it without a word', () => {
    expect(starNews(empty, null)).toBeNull();
    expect(quietSeen(empty, null)).toEqual(seenOf(empty));
  });

  it('welcomes a diary that already holds stars on the first check', () => {
    // One day: the first star of "Am Ball" and nothing else.
    expect(starNews(one, null)).toEqual({ kind: 'welcome', stars: 1 });
    expect(quietSeen(one, null)).toBeNull();
  });

  it('announces stars earned since the last check', () => {
    const news = starNews(one, seenOf(empty));
    expect(news).toMatchObject({ kind: 'stars', count: 1 });
    if (news?.kind !== 'stars') throw new Error('expected stars');
    expect(news.earned.map(({ achievement, from }) => [achievement.key, from, achievement.stars])).toEqual([['days', 0, 1]]);
    expect(starNews(one, seenOf(one))).toBeNull();
  });

  it('lowers the stored stars silently when stars went away, so earning them again is news again', () => {
    const seen = seenOf(one);
    expect(starNews(empty, seen)).toBeNull();
    const lowered = quietSeen(empty, seen);
    expect(lowered).toEqual(seenOf(empty));
    expect(starNews(one, lowered)).toMatchObject({ kind: 'stars' });
  });
});
