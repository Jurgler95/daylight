import { usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';

import { useToday } from '@/lib/dates/useToday';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { parseSeen, quietSeen, seenOf, starNews, type StarNews } from './news';
import { useAchievements } from './useAchievements';

/** The achievements tab itself: whoever looks at it has seen every star. */
export const ACHIEVEMENTS_PATH = '/achievements';
/** Screens a message would cover in the middle of writing; it waits until they close. */
const BUSY = ['/entry', '/photo', '/turning/new'];

/**
 * New stars since the last announcement, and the way to mark them as seen. Stores without asking
 * when nothing is to be announced (first check of an empty diary, stars that went away) and when
 * the achievements tab is open.
 */
export function useStarNews(): { news: StarNews | null; acknowledge: () => void } {
  const today = useToday();
  const achievements = useAchievements(today);
  const stored = useSettingsStore((s) => s.settings?.achievements_seen ?? null);
  const update = useSettingsStore((s) => s.update);
  const pathname = usePathname();

  const seen = useMemo(() => parseSeen(stored), [stored]);
  const news = useMemo(() => starNews(achievements, seen), [achievements, seen]);
  const acknowledge = useCallback(() => update({ achievements_seen: JSON.stringify(seenOf(achievements)) }), [update, achievements]);
  const onTab = pathname === ACHIEVEMENTS_PATH;

  useEffect(() => {
    if (onTab && news) return acknowledge();
    const quiet = quietSeen(achievements, seen);
    if (quiet) update({ achievements_seen: JSON.stringify(quiet) });
  }, [onTab, news, achievements, seen, acknowledge, update]);

  const busy = BUSY.some((prefix) => pathname.startsWith(prefix));
  return { news: onTab || busy ? null : news, acknowledge };
}
