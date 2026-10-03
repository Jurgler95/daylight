import { addDaysToDateString, type DateString } from '@/lib/dates';
import { isStarterActivity } from '@/lib/daylio/known';

import { buildAchievements, countWords, dayRuns, MAX_STARS, totalStars, weekRuns, windowSums, type AchievementEntry, type AchievementInput } from '../achievements';

const d = (value: string) => value as DateString;
const today = d('2026-10-03');

function entry(date: string, extra: Partial<AchievementEntry> = {}): AchievementEntry {
  return { date, activity_ids: [], note_title: null, note: null, photos: [], scales: [], ...extra };
}

/** `count` consecutive days ending `end`, oldest first. */
function daysBack(end: DateString, count: number): DateString[] {
  return Array.from({ length: count }, (_, i) => addDaysToDateString(end, i - count + 1));
}

function input(extra: Partial<AchievementInput>): AchievementInput {
  return { entries: [], health: [], activities: [], isStarter: isStarterActivity, opens: 0, today, firstDayOfWeek: 1, ...extra };
}

const byKey = (achievements: ReturnType<typeof buildAchievements>) => new Map(achievements.map((a) => [a.key, a]));

describe('dayRuns', () => {
  it('finds the longest run and keeps the current one alive while today is still empty', () => {
    const dates = [...daysBack(d('2026-09-10'), 5), ...daysBack(d('2026-10-02'), 3)];
    expect(dayRuns(dates, today)).toEqual({ longest: 5, current: 3 });
  });

  it('drops the current run after a missed day', () => {
    expect(dayRuns(daysBack(d('2026-10-01'), 4), today)).toEqual({ longest: 4, current: 0 });
  });

  it('counts a day with several entries once and handles month and year turns', () => {
    expect(dayRuns(['2025-12-31', '2026-01-01', '2026-01-01', '2026-01-02'], d('2026-01-02'))).toEqual({ longest: 3, current: 3 });
  });

  it('is zero without dates', () => {
    expect(dayRuns([], today)).toEqual({ longest: 0, current: 0 });
  });
});

describe('weekRuns', () => {
  // 2026-09-14, 21, 28 are Mondays; today (Sat 3 Oct) lies in the week of the 28th.
  const week = (monday: string, days: number) => daysBack(addDaysToDateString(d(monday), days - 1), days);

  it('needs five days per week and lets the running week finish', () => {
    const dates = [...week('2026-09-14', 5), ...week('2026-09-21', 7), ...week('2026-09-28', 2)];
    expect(weekRuns(dates, today, 1)).toEqual({ longest: 2, current: 2 });
  });

  it('breaks on a week with only four days', () => {
    const dates = [...week('2026-09-07', 5), ...week('2026-09-14', 4), ...week('2026-09-21', 5)];
    expect(weekRuns(dates, today, 1)).toEqual({ longest: 1, current: 1 });
  });
});

describe('windowSums', () => {
  it('takes the best seven days in a row and the last seven days', () => {
    const values = new Map([
      ['2026-09-01', 100],
      ['2026-09-07', 50],
      ['2026-09-08', 70],
      ['2026-09-30', 10],
      ['2026-10-03', 5],
    ]);
    // 1 to 7 September: 150; 2 to 8: 120.
    expect(windowSums(values, today)).toEqual({ best: 150, current: 15 });
  });
});

describe('countWords', () => {
  it('counts words with umlauts and numbers, not punctuation', () => {
    expect(countWords('Heute 10 km gelaufen, müde, aber froh!')).toBe(7);
    expect(countWords('  ')).toBe(0);
  });
});

describe('buildAchievements', () => {
  it('gives nothing to an empty diary', () => {
    const achievements = buildAchievements(input({}));
    expect(totalStars(achievements)).toBe(0);
    expect(achievements.every((a) => a.next === a.tiers[0])).toBe(true);
    expect(MAX_STARS).toBe(achievements.length * 5);
  });

  it('rewards tracking only: the same diary earns the same stars whatever the mood', () => {
    const dates = daysBack(today, 20);
    const entries = dates.map((date, i) =>
      entry(date, { activity_ids: [1, 2, i % 3 === 0 ? 3 : 4], note: 'eins zwei drei vier fünf', photos: i < 7 ? [`p${i}.jpg`] : [], scales: [{}] }),
    );
    const achievements = byKey(buildAchievements(input({ entries })));

    expect(achievements.get('days')).toMatchObject({ best: 20, current: 20, stars: 2, next: 100 });
    // 20 of the 1826 days the fifth star asks for.
    expect(achievements.get('days')!.progress).toBeCloseTo(20 / 1826);
    expect(achievements.get('photoDays')!.progress).toBeCloseTo(7 / 365);
    expect(achievements.get('activityDays')).toMatchObject({ best: 20, stars: 2 });
    expect(achievements.get('noteDays')).toMatchObject({ best: 20, stars: 2 });
    // Photos on the first seven days only: the run is over, the stars stay.
    expect(achievements.get('photoDays')).toMatchObject({ best: 7, current: 0, stars: 2 });
    expect(achievements.get('totalDays')).toMatchObject({ best: 20, current: null, stars: 1 });
    expect(achievements.get('weekWords')).toMatchObject({ best: 35, current: 35, stars: 0 });
    expect(achievements.get('chips')).toMatchObject({ best: 60, stars: 1 });
    expect(achievements.get('weekChips')).toMatchObject({ best: 21, stars: 1 });
    expect(achievements.get('variety')).toMatchObject({ best: 4, stars: 0 });
    expect(achievements.get('photos')).toMatchObject({ best: 7, stars: 1 });
    expect(achievements.get('scaleDays')).toMatchObject({ best: 20, stars: 2 });
  });

  it('reaches all five stars for five years in a row', () => {
    const entries = daysBack(today, 1826).map((date) => entry(date));
    const days = byKey(buildAchievements(input({ entries }))).get('days')!;
    expect(days).toMatchObject({ stars: 5, next: null, progress: 1 });
  });

  it('counts sleep and steps from health days that have a value', () => {
    const health = daysBack(today, 14).map((date, i) => ({ date, steps: i === 3 ? 0 : 5000, sleep_minutes: 420 }));
    const achievements = byKey(buildAchievements(input({ health })));
    expect(achievements.get('sleepDays')).toMatchObject({ best: 14, stars: 2 });
    expect(achievements.get('stepDays')).toMatchObject({ best: 10, current: 10, stars: 1 });
  });

  it('gives the first star for app opens on the second opening and the fifth at 5000', () => {
    const opens = (count: number) => byKey(buildAchievements(input({ opens: count }))).get('opens')!;
    expect(opens(1).stars).toBe(0);
    expect(opens(2).stars).toBe(1);
    expect(opens(4999).stars).toBe(4);
    expect(opens(5000)).toMatchObject({ stars: 5, next: null });
  });

  it('counts self-made activities, not the starters in either language', () => {
    const activities = [{ name: 'Glücklich' }, { name: 'Happy' }, { name: 'Bouldern' }, { name: 'Klavier' }];
    expect(byKey(buildAchievements(input({ activities }))).get('custom')).toMatchObject({ best: 2, stars: 1 });
  });
});
