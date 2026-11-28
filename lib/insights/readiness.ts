import type { Insights } from './overview';

/**
 * How much a diary needs before "Einblicke" say something, all in one place. Everything counts days
 * with an entry: three entries on one day are one day to every card.
 *
 * Below `diaryDays` in the whole diary the page shows how far it is instead of cards: a chart of two
 * points looks broken, not promising. After that every card waits for its own minimum inside the
 * range picked and says in one line what it still needs (`InsightCard`'s `empty`). Cards with a
 * minimum of their own in `lib/insights` (swings, words, pairs, before hard days, links) keep it.
 */
export const INSIGHT_MINIMUMS = {
  /** The page as a whole: a week, the shortest stretch in which any pattern can show. */
  diaryDays: 7,
  /** Mean tile, course and distribution: fewer days in the range than this tell nothing yet. */
  rangeDays: 3,
  /** Weekdays: two weeks in the range, so most weekdays come up twice... */
  weekdayDays: 14,
  /** ...spread over at least this many different weekdays. */
  weekdays: 5,
  /** Months: at least two months of the range with entries, or there is nothing to set side by side. */
  months: 2,
} as const;

export interface InsightReadiness {
  /** Days with an entry in the whole diary, at most `diaryDays`: what the progress card counts up. */
  diaryDays: number;
  /** Days with an entry still missing before the cards show; 0 once they do. */
  missing: number;
  /** Enough days in the range for the mean tile, the course and the distribution. */
  overview: boolean;
  /** Enough days on enough different weekdays in the range for the weekday card. */
  weekdays: boolean;
  /** Enough months with entries in the range for the month card. */
  months: boolean;
}

export function insightReadiness(insights: Pick<Insights, 'allDays' | 'days' | 'weekdays' | 'months'>): InsightReadiness {
  const min = INSIGHT_MINIMUMS;
  const total = insights.allDays.length;
  const weekdaysWithDays = insights.weekdays.weekdays.filter((weekday) => weekday.days > 0).length;
  return {
    diaryDays: Math.min(total, min.diaryDays),
    missing: Math.max(0, min.diaryDays - total),
    overview: insights.days.length >= min.rangeDays,
    weekdays: insights.days.length >= min.weekdayDays && weekdaysWithDays >= min.weekdays,
    months: insights.months.length >= min.months,
  };
}
