import { openPlayStore, PLAY_STORE_URL, PLAY_WEB_URL, reviewPromptDue, usageDays } from '../prompt';

/** Local noon of a day in September, as `created_at` stores it (UTC). */
const savedOn = (day: number) => new Date(2026, 8, day, 12).toISOString();
const week = [1, 2, 3, 4, 5, 6, 7].map(savedOn);

describe('rating card', () => {
  it('counts the days entries were saved on, not the days they are about', () => {
    expect(usageDays(week)).toBe(7);
    // A whole import or the sample data: many entries, one sitting.
    expect(usageDays(Array.from({ length: 365 }, () => savedOn(3)))).toBe(1);
    expect(usageDays([savedOn(1), new Date(2026, 8, 1, 23, 30).toISOString(), 'broken'])).toBe(1);
  });

  it('is due from seven days of use until it was answered', () => {
    expect(reviewPromptDue({ createdAt: week.slice(0, 6), done: false })).toBe(false);
    expect(reviewPromptDue({ createdAt: week, done: false })).toBe(true);
    expect(reviewPromptDue({ createdAt: [...week, savedOn(20)], done: false })).toBe(true);
    expect(reviewPromptDue({ createdAt: week, done: true })).toBe(false);
  });

  it('opens the store app, else the web page, and never throws', async () => {
    const opened: string[] = [];
    expect(await openPlayStore(async (url) => void opened.push(url))).toBe(true);
    expect(opened).toEqual([PLAY_STORE_URL]);

    const tried: string[] = [];
    const noStore = async (url: string) => {
      tried.push(url);
      if (url.startsWith('market:')) throw new Error('No Activity found');
    };
    expect(await openPlayStore(noStore)).toBe(true);
    expect(tried).toEqual([PLAY_STORE_URL, PLAY_WEB_URL]);

    expect(await openPlayStore(async () => Promise.reject(new Error('nothing')))).toBe(false);
  });
});
