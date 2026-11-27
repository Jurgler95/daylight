import { addDaysToDateString, type DateString } from '@/lib/dates';

import {
  ANDROID_ALARM_LIMIT,
  answered,
  dailyKeysOfTimes,
  doneReminderKeys,
  entryLink,
  formatTime,
  localTrigger,
  parseTime,
  planReminders,
  planSignature,
  REMINDER_DAYS,
  reminderLink,
  timeZoneKey,
  yesterdayCandidates,
  type PlanInput,
  type ReminderWording,
  writtenAt,
} from '../plan';

const today = '2026-09-26' as DateString;
const day = (offset: number) => addDaysToDateString(today, offset);
/** Entries on the given offsets from today. */
const entries = (...offsets: number[]) => new Set<string>(offsets.map(day));

const wording: ReminderWording = {
  title: 'Erinnerung',
  daily: (n) => (n === null ? 'Wie war dein Tag?' : `Wie war dein Tag? Tag ${n} deiner Serie.`),
  moment: (n) => (n === null ? 'Wie geht es dir gerade?' : `Wie geht es dir gerade? Tag ${n} deiner Serie.`),
  yesterday: (n) => (n === null ? 'Gestern fehlt noch ein Eintrag.' : `Gestern fehlt noch. Trag es nach, dann bleiben deine ${n} Tage.`),
  outlook: 'Dein Ausblick für heute ist da',
};

const input = (overrides: Partial<PlanInput> = {}): PlanInput => ({
  today,
  nowMinutes: 12 * 60,
  enabled: true,
  times: ['20:30'],
  yesterdayEnabled: false,
  yesterdayTime: '10:00',
  entryDays: new Set(),
  wording,
  ...overrides,
});

const daily = (overrides: Partial<PlanInput> = {}) => planReminders(input(overrides)).filter((r) => r.kind === 'daily');
const mornings = (overrides: Partial<PlanInput> = {}) =>
  planReminders(input({ yesterdayEnabled: true, ...overrides })).filter((r) => r.kind === 'yesterday');

describe('planReminders', () => {
  it('plans nothing while the reminder is off', () => {
    expect(planReminders(input({ enabled: false }))).toEqual([]);
    // The morning reminder only comes along with the daily one.
    expect(planReminders(input({ enabled: false, yesterdayEnabled: true, entryDays: entries(-2) }))).toEqual([]);
  });

  it('plans one reminder a day at the chosen time, starting today', () => {
    const plan = planReminders(input());
    expect(plan).toHaveLength(REMINDER_DAYS);
    expect(plan[0]).toEqual({
      key: 'daily:2026-09-26T20:30',
      kind: 'daily',
      date: '2026-09-26',
      hour: 20,
      minute: 30,
      openDate: '2026-09-26',
      title: 'Erinnerung',
      body: 'Wie war dein Tag?',
    });
    expect(plan[1]).toMatchObject({ date: '2026-09-27', hour: 20, minute: 30 });
    expect(plan[REMINDER_DAYS - 1]!.date).toBe('2026-10-09');
  });

  it('drops today once there is an entry', () => {
    const plan = planReminders(input({ entryDays: entries(0) }));
    expect(plan).toHaveLength(REMINDER_DAYS - 1);
    expect(plan[0]!.date).toBe('2026-09-27');
  });

  it('keeps today despite an entry when it should always come, but not once the time has passed', () => {
    const plan = daily({ always: true, entryDays: entries(-1, 0) });
    expect(plan).toHaveLength(REMINDER_DAYS);
    expect(plan[0]).toMatchObject({ date: '2026-09-26', body: 'Wie war dein Tag? Tag 2 deiner Serie.' });
    expect(daily({ always: true, entryDays: entries(0), nowMinutes: 21 * 60 })[0]!.date).toBe('2026-09-27');
  });

  it('drops today once the time has passed, and keeps it while it is ahead', () => {
    expect(planReminders(input({ nowMinutes: 20 * 60 + 30 }))[0]!.date).toBe('2026-09-27');
    expect(planReminders(input({ nowMinutes: 20 * 60 + 29 }))[0]!.date).toBe('2026-09-26');
  });

  it('ignores an invalid time instead of throwing', () => {
    expect(planReminders(input({ times: ['25:00'] }))).toEqual([]);
    expect(planReminders(input({ times: ['8:30'] }))).toEqual([]);
  });

  it('changes its signature when the time, today or the text changes, not otherwise', () => {
    const a = planSignature(planReminders(input()));
    expect(planSignature(planReminders(input({ nowMinutes: 13 * 60 })))).toBe(a);
    expect(planSignature(planReminders(input({ times: ['21:00'] })))).not.toBe(a);
    expect(planSignature(planReminders(input({ entryDays: entries(0) })))).not.toBe(a);
    // Same days and times, another streak: the text differs, so the device is reprogrammed.
    const streak = planSignature(planReminders(input({ entryDays: entries(-1) })));
    expect(streak).not.toBe(a);
    expect(planSignature(planReminders(input({ entryDays: entries(-1, -2) })))).not.toBe(streak);
    expect(planSignature(planReminders(input({ wording: { ...wording, title: 'Reminder' } })))).not.toBe(a);
  });

  it('changes its signature with the time zone, so a return to the app after a move reschedules', () => {
    const plan = planReminders(input());
    const berlin = planSignature(plan, 'Europe/Berlin-120');
    expect(planSignature(plan, 'Europe/Berlin-120')).toBe(berlin);
    expect(planSignature(plan, 'Europe/London-60')).not.toBe(berlin);
    expect(planSignature(plan, 'Europe/Berlin-60')).not.toBe(berlin);
    // An empty plan cancels everything wherever the phone is.
    expect(planSignature([], 'Europe/London-60')).toBe(planSignature([], 'Europe/Berlin-120'));
  });

  it('names the time zone and its current offset', () => {
    const now = new Date(2026, 9, 15, 12, 0);
    expect(timeZoneKey(now)).toMatch(new RegExp(`${now.getTimezoneOffset()}$`));
  });

  it('hands the wall-clock time of each reminder to the module', () => {
    const first = planReminders(input())[0]!;
    expect(localTrigger(first)).toBe('2026-09-26T20:30');
    expect(localTrigger({ ...first, hour: 7, minute: 5 })).toBe('2026-09-26T07:05');
  });

  it('parses and formats "HH:mm"', () => {
    expect(parseTime('07:05')).toEqual({ hour: 7, minute: 5 });
    expect(parseTime('24:00')).toBeNull();
    expect(formatTime(7, 5)).toBe('07:05');
  });
});

describe('evening text', () => {
  it('names the streak day the evening would make: the run up to yesterday plus today', () => {
    // Entries on the four days before today, none today: tonight would be day 5.
    const plan = daily({ entryDays: entries(-4, -3, -2, -1) });
    expect(plan[0]).toMatchObject({ date: day(0), body: 'Wie war dein Tag? Tag 5 deiner Serie.' });
  });

  it('starts at day 2, so a single day before gives the number and none gives the plain text', () => {
    expect(daily({ entryDays: entries(-1) })[0]!.body).toBe('Wie war dein Tag? Tag 2 deiner Serie.');
    expect(daily()[0]!.body).toBe('Wie war dein Tag?');
  });

  it('stays plain when yesterday is missing, even with a streak before it', () => {
    expect(daily({ entryDays: entries(-4, -3, -2) })[0]!.body).toBe('Wie war dein Tag?');
  });

  it('counts tomorrow from today once today has an entry', () => {
    const plan = daily({ entryDays: entries(-2, -1, 0) });
    expect(plan[0]).toMatchObject({ date: day(1), body: 'Wie war dein Tag? Tag 4 deiner Serie.' });
  });

  it('stays plain tomorrow when today is still empty and its time has passed', () => {
    const plan = daily({ entryDays: entries(-2, -1), nowMinutes: 21 * 60 });
    expect(plan[0]).toMatchObject({ date: day(1), body: 'Wie war dein Tag?' });
  });

  it('puts the number only into the next reminder, the ones further ahead stay plain', () => {
    const plan = daily({ entryDays: entries(-1) });
    expect(plan[0]!.body).toContain('Tag 2');
    expect(plan.slice(1).every((r) => r.body === 'Wie war dein Tag?')).toBe(true);
  });

  it('opens the editor for the day itself', () => {
    expect(daily()[3]).toMatchObject({ date: day(3), openDate: day(3) });
  });
});

describe('morning reminder', () => {
  it('stays away while its own switch is off', () => {
    expect(planReminders(input({ entryDays: entries(-2) })).some((r) => r.kind === 'yesterday')).toBe(false);
  });

  it('comes today when yesterday is missing and the day before has an entry', () => {
    const plan = mornings({ entryDays: entries(-3, -2), nowMinutes: 9 * 60 });
    expect(plan).toEqual([
      {
        key: `yesterday:${day(0)}`,
        kind: 'yesterday',
        date: day(0),
        hour: 10,
        minute: 0,
        openDate: day(-1),
        title: 'Erinnerung',
        body: 'Gestern fehlt noch. Trag es nach, dann bleiben deine 2 Tage.',
      },
    ]);
  });

  it('comes today whatever today holds, then two days on as well', () => {
    const plan = mornings({ entryDays: entries(-2, 0), nowMinutes: 9 * 60 });
    expect(plan.map((r) => r.date)).toEqual([day(0), day(2)]);
    // Only the first carries the number.
    expect(plan[0]!.body).toBe('Gestern fehlt noch. Trag es nach, dann bleiben deine 1 Tage.');
    expect(plan[1]).toMatchObject({ openDate: day(1), body: 'Gestern fehlt noch ein Eintrag.' });
  });

  it('skips today once its time has passed', () => {
    expect(mornings({ entryDays: entries(-2), nowMinutes: 10 * 60 }).map((r) => r.date)).toEqual([]);
    expect(mornings({ entryDays: entries(-2), nowMinutes: 9 * 60 + 59 }).map((r) => r.date)).toEqual([day(0)]);
  });

  it('comes tomorrow when today is still empty and yesterday has an entry', () => {
    const plan = mornings({ entryDays: entries(-3, -2, -1) });
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ date: day(1), openDate: day(0), body: 'Gestern fehlt noch. Trag es nach, dann bleiben deine 3 Tage.' });
  });

  it('comes the day after tomorrow once today has an entry, counting today', () => {
    const plan = mornings({ entryDays: entries(-1, 0) });
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ date: day(2), openDate: day(1), body: 'Gestern fehlt noch. Trag es nach, dann bleiben deine 2 Tage.' });
  });

  it('plans nothing when there is no streak to keep', () => {
    expect(mornings()).toEqual([]);
    // Yesterday and the day before missing: today's morning is not the one after the gap began.
    expect(mornings({ entryDays: entries(-3), nowMinutes: 9 * 60 })).toEqual([]);
  });

  it('ignores an invalid morning time', () => {
    expect(mornings({ entryDays: entries(-1), yesterdayTime: '7:00' })).toEqual([]);
  });

  it('changes the signature with the morning time', () => {
    const base = { yesterdayEnabled: true, entryDays: entries(-1) };
    expect(planSignature(planReminders(input(base)))).not.toBe(planSignature(planReminders(input({ ...base, yesterdayTime: '09:00' }))));
  });
});

describe('outlook notification', () => {
  /** Hints shown on the given offsets from today, the notification at 08:00. */
  const outlook = (...offsets: number[]) => ({ time: '08:00', hintDays: entries(...offsets) });
  const notes = (overrides: Partial<PlanInput> = {}) => planReminders(input({ enabled: false, ...overrides })).filter((r) => r.kind === 'outlook');

  it('comes the morning after a hint, with one line that says nothing of the hint, and opens "Heute"', () => {
    expect(notes({ outlook: outlook(0), entryDays: entries(0) })).toEqual([
      { key: `outlook:${day(1)}`, kind: 'outlook', date: day(1), hour: 8, minute: 0, openDate: null, title: 'Dein Ausblick für heute ist da', body: '' },
    ]);
    expect(reminderLink(notes({ outlook: outlook(0), entryDays: entries(0) })[0]!)).toBe('daylight://today');
    expect(reminderLink(planReminders(input())[0]!)).toBe(entryLink(day(0)));
  });

  it('needs neither the evening reminder nor the morning one', () => {
    expect(notes({ outlook: outlook(0), entryDays: entries(0) })).toHaveLength(1);
    expect(planReminders(input({ enabled: false, outlook: outlook(0), entryDays: entries(0) })).every((r) => r.kind === 'outlook')).toBe(true);
  });

  it('stays away while it is off, and without a hint', () => {
    expect(notes({ outlook: null, entryDays: entries(0) })).toEqual([]);
    expect(notes({ outlook: outlook(), entryDays: entries(0) })).toEqual([]);
    expect(notes({ outlook: outlook(-3), entryDays: entries(0) })).toEqual([]);
  });

  it('comes this morning for yesterday’s hint while today is empty and the time is ahead', () => {
    expect(notes({ outlook: outlook(-1), nowMinutes: 7 * 60 }).map((r) => r.date)).toEqual([day(0)]);
    expect(notes({ outlook: outlook(-1), nowMinutes: 8 * 60 })).toEqual([]);
    expect(notes({ outlook: outlook(-1), nowMinutes: 7 * 60, entryDays: entries(0) })).toEqual([]);
  });

  it('is taken off the screen once its day has an entry', () => {
    expect(doneReminderKeys(entries(0), today)).toContain(`outlook:${day(0)}`);
    expect(doneReminderKeys(entries(-1), today)).not.toContain(`outlook:${day(0)}`);
  });

  it('ignores an invalid time, and a new time changes the signature', () => {
    expect(notes({ outlook: { time: '8:00', hintDays: entries(0) }, entryDays: entries(0) })).toEqual([]);
    const plan = (time: string) => planSignature(planReminders(input({ outlook: { time, hintDays: entries(0) }, entryDays: entries(0) })));
    expect(plan('08:00')).not.toBe(plan('07:30'));
  });
});

describe('yesterdayCandidates', () => {
  // Every combination of entries on T-2, T-1 and T, with the morning time still ahead or passed.
  const cases: [string, number[], boolean, number[]][] = [
    ['nothing', [], true, []],
    ['only T-2', [-2], true, [0]],
    ['only T-2, time passed', [-2], false, []],
    ['only T-1', [-1], true, [1]],
    ['only T', [0], true, [2]],
    ['T-2 and T-1', [-2, -1], true, [1]],
    ['T-2 and T', [-2, 0], true, [0, 2]],
    ['T-2 and T, time passed', [-2, 0], false, [2]],
    ['T-1 and T', [-1, 0], true, [2]],
    ['T-2, T-1 and T', [-2, -1, 0], true, [2]],
  ];
  it.each(cases)('%s', (_, offsets, timeAhead, expected) => {
    expect(yesterdayCandidates(entries(...offsets), today, timeAhead)).toEqual(expected.map(day));
  });

  it('never plans tomorrow and the day after together', () => {
    for (let mask = 0; mask < 8; mask += 1) {
      const offsets = [-2, -1, 0].filter((_, bit) => mask & (1 << bit));
      const dates = yesterdayCandidates(entries(...offsets), today, true);
      expect(dates.includes(day(1)) && dates.includes(day(2))).toBe(false);
    }
  });
});

describe('doneReminderKeys', () => {
  const one = { times: ['20:30'] };

  it('names the evening of a day with an entry and the morning after it', () => {
    const keys = doneReminderKeys(entries(-1), today, one);
    expect(keys).toContain(`daily:${day(-1)}T20:30`);
    expect(keys).toContain(`yesterday:${day(0)}`);
    expect(keys).not.toContain(`daily:${day(0)}T20:30`);
  });

  it('still names the key from before several times a day, so an old notification goes too', () => {
    expect(doneReminderKeys(entries(-1), today, one)).toContain(`daily:${day(-1)}`);
    expect(doneReminderKeys(entries(-1), today)).toContain(`daily:${day(-1)}`);
  });

  it('looks back as far as reminders are planned', () => {
    const first = day(-(REMINDER_DAYS - 1));
    expect(doneReminderKeys(entries(-(REMINDER_DAYS - 1)), today, one)).toEqual([`daily:${first}`, `daily:${first}T20:30`, `outlook:${first}`, `yesterday:${day(-(REMINDER_DAYS - 2))}`]);
    expect(doneReminderKeys(entries(-REMINDER_DAYS - 1), today, one)).toEqual([]);
  });

  it('with one time takes it off for any entry of the day, whatever its time', () => {
    for (const time of ['00:00', '20:30', '23:59']) {
      expect(doneReminderKeys(entries(0), today, { times: ['20:30'], entryTimes: new Map([[today, [time]]]) })).toContain(`daily:${today}T20:30`);
    }
    // Also when nothing is known about the times.
    expect(doneReminderKeys(entries(0), today, one)).toContain(`daily:${today}T20:30`);
  });

  describe('with several times', () => {
    const times = ['09:00', '14:00', '21:00'];
    const done = (...entryTimes: string[]) =>
      doneReminderKeys(entries(0), today, { times, entryTimes: new Map([[today, entryTimes]]) })
        .filter((key) => key.startsWith(`daily:${today}T`))
        .map((key) => key.slice(-5));

    it('takes a reminder off once its own part of the day has an entry, or a later one has', () => {
      // An entry nearest to 09:00 answers that one only; one nearer to 14:00 takes 09:00 along.
      expect(done('10:00')).toEqual(['09:00']);
      expect(done('12:00')).toEqual(['09:00', '14:00']);
      // Written after 21:00 showed: everything on screen goes.
      expect(done('21:10')).toEqual(['09:00', '14:00', '21:00']);
      // Only the morning was written down: what showed later stays.
      expect(done('08:00')).toEqual(['09:00']);
    });

    it('keeps the evening one on screen while only earlier entries exist', () => {
      expect(done('08:00', '12:00')).toEqual(['09:00', '14:00']);
      expect(done('08:00', '12:00', '22:00')).toEqual(['09:00', '14:00', '21:00']);
    });

    it('draws the line halfway between two reminders, at the minute', () => {
      expect(done('11:29')).toEqual(['09:00']);
      expect(done('11:30')).toEqual(['09:00', '14:00']);
      expect(done('17:29')).toEqual(['09:00', '14:00']);
      expect(done('17:30')).toEqual(['09:00', '14:00', '21:00']);
      expect(done('00:00')).toEqual(['09:00']);
    });

    it('takes a shown one off once an entry for its day is written after it, also one dated earlier', () => {
      const at = (entryTime: string, moment: string) =>
        doneReminderKeys(entries(0), today, { times, entryTimes: new Map([[today, [entryTime]]]), written: new Map([[today, [`${today}T${moment}`]]]) })
          .filter((key) => key.startsWith(`daily:${today}T`))
          .map((key) => key.slice(-5));
      // 14:00 is on screen; at 14:30 an entry dated 08:30 is written: 09:00 and 14:00 go, 21:00 never showed.
      expect(at('08:30', '14:30')).toEqual(['09:00', '14:00']);
      // Written in the very minute the reminder fires counts, a minute before does not.
      expect(at('08:30', '14:00')).toEqual(['09:00', '14:00']);
      expect(at('08:30', '13:59')).toEqual(['09:00']);
      // Written in the evening: everything that showed goes.
      expect(at('08:30', '21:05')).toEqual(['09:00', '14:00', '21:00']);
    });

    it('counts an entry added on a later day for every reminder of the day it is for', () => {
      const keys = doneReminderKeys(entries(-1), today, { times, entryTimes: new Map([[day(-1), ['08:00']]]), written: new Map([[day(-1), [`${today}T07:00`]]]) });
      expect(keys.filter((key) => key.includes('T'))).toEqual([`daily:${day(-1)}T09:00`, `daily:${day(-1)}T14:00`, `daily:${day(-1)}T21:00`]);
    });

    it('names nothing for a day without an entry, and other days by their own entries', () => {
      const keys = doneReminderKeys(entries(-1), today, { times, entryTimes: new Map([[day(-1), ['18:00']]]) });
      expect(keys.filter((key) => key.includes('T'))).toEqual([`daily:${day(-1)}T09:00`, `daily:${day(-1)}T14:00`, `daily:${day(-1)}T21:00`]);
    });
  });
});

describe('writtenAt', () => {
  it('gives the wall-clock minute of a timestamp, in the device\'s zone', () => {
    expect(writtenAt(new Date(2026, 8, 26, 14, 30, 59).toISOString())).toBe('2026-09-26T14:30');
    expect(writtenAt(new Date(2026, 0, 5, 0, 0, 0).toISOString())).toBe('2026-01-05T00:00');
  });

  it('gives null for what is no timestamp', () => {
    expect(writtenAt('')).toBeNull();
    expect(writtenAt('gestern')).toBeNull();
  });
});

describe('dailyKeysOfTimes', () => {
  it('names the keys of the given times for as many days back as reminders are planned', () => {
    const keys = dailyKeysOfTimes(['20:30'], today);
    expect(keys).toHaveLength(REMINDER_DAYS);
    expect(keys[0]).toBe(`daily:${day(-(REMINDER_DAYS - 1))}T20:30`);
    expect(keys.at(-1)).toBe(`daily:${today}T20:30`);
    expect(dailyKeysOfTimes(['09:00', '20:30'], today)).toHaveLength(2 * REMINDER_DAYS);
    expect(dailyKeysOfTimes([], today)).toEqual([]);
  });
});

describe('several times a day', () => {
  const times = ['09:00', '14:00', '21:00'];
  /** The times still planned for today, at 06:00 unless said otherwise, with entries at the given times. */
  const todays = (entryTimes: string[], overrides: Partial<PlanInput> = {}) =>
    daily({ times, nowMinutes: 6 * 60, entryDays: entryTimes.length ? entries(0) : new Set(), entryTimes: new Map([[today, entryTimes]]), ...overrides })
      .filter((r) => r.date === today)
      .map((r) => formatTime(r.hour, r.minute));

  it('plans every time on every day, earliest first, with a key of its own', () => {
    const plan = daily({ times: ['21:00', '09:00', '14:00'], nowMinutes: 6 * 60 });
    expect(plan).toHaveLength(3 * REMINDER_DAYS);
    expect(plan.slice(0, 4).map((r) => r.key)).toEqual([`daily:${today}T09:00`, `daily:${today}T14:00`, `daily:${today}T21:00`, `daily:${day(1)}T09:00`]);
    expect(new Set(plan.map((r) => r.key)).size).toBe(plan.length);
    expect(plan.every((r) => r.openDate === r.date)).toBe(true);
  });

  it('ignores invalid and repeated times', () => {
    expect(daily({ times: ['09:00', '9:00', '09:00', '25:00'], nowMinutes: 0 }).filter((r) => r.date === today)).toHaveLength(1);
    expect(daily({ times: [] })).toEqual([]);
  });

  it('leaves out the times of today that have passed', () => {
    expect(todays([], { nowMinutes: 9 * 60 })).toEqual(['14:00', '21:00']);
    expect(todays([], { nowMinutes: 14 * 60 - 1 })).toEqual(['14:00', '21:00']);
    expect(todays([], { nowMinutes: 21 * 60 })).toEqual([]);
  });

  it('skips the reminder nearest to the time of an entry, before or after it', () => {
    // Answered a little late: 09:05 belongs to 09:00, so 14:00 still comes.
    expect(todays(['09:05'])).toEqual(['14:00', '21:00']);
    expect(todays(['10:00'])).toEqual(['14:00', '21:00']);
    expect(todays(['08:00'])).toEqual(['14:00', '21:00']);
    // Nearer to the next one: that one stays away, whether the entry lies before or after it.
    expect(todays(['12:00'])).toEqual(['09:00', '21:00']);
    expect(todays(['15:00'])).toEqual(['09:00', '21:00']);
    expect(todays(['18:00'])).toEqual(['09:00', '14:00']);
    expect(todays([])).toEqual(['09:00', '14:00', '21:00']);
  });

  it('covers every combination of three times', () => {
    expect(todays(['08:00', '12:00'])).toEqual(['21:00']);
    expect(todays(['08:00', '18:00'])).toEqual(['14:00']);
    expect(todays(['12:00', '18:00'])).toEqual(['09:00']);
    expect(todays(['08:00', '12:00', '18:00'])).toEqual([]);
    // Two entries near the same reminder answer that one only.
    expect(todays(['09:30', '10:30'])).toEqual(['14:00', '21:00']);
  });

  it('covers every combination of two times', () => {
    // 09:00 and 21:00 meet at 15:00.
    const two = (entryTimes: string[]) => todays(entryTimes, { times: ['09:00', '21:00'] });
    expect(two([])).toEqual(['09:00', '21:00']);
    expect(two(['08:00'])).toEqual(['21:00']);
    expect(two(['14:59'])).toEqual(['21:00']);
    expect(two(['16:00'])).toEqual(['09:00']);
    expect(two(['08:00', '16:00'])).toEqual([]);
  });

  it('draws the line halfway between two reminders, at the minute', () => {
    // 09:00, 14:00 and 21:00 meet at 11:30 and 17:30; exactly halfway goes to the later one.
    expect(todays(['11:29'])).toEqual(['14:00', '21:00']);
    expect(todays(['11:30'])).toEqual(['09:00', '21:00']);
    expect(todays(['17:29'])).toEqual(['09:00', '21:00']);
    expect(todays(['17:30'])).toEqual(['09:00', '14:00']);
    expect(todays(['15:00'], { times: ['09:00', '21:00'] })).toEqual(['09:00']);
    // An entry at a reminder time belongs to that reminder.
    expect(todays(['14:00'])).toEqual(['09:00', '21:00']);
    expect(todays(['09:00'])).toEqual(['14:00', '21:00']);
    // Halfway on a half minute (09:00 and 14:01 meet at 11:30 and a half): no tie, the nearer one wins.
    expect(todays(['11:30'], { times: ['09:00', '14:01'] })).toEqual(['14:01']);
    expect(todays(['11:31'], { times: ['09:00', '14:01'] })).toEqual(['09:00']);
    // The first part starts at midnight, the last one reaches to the end of the day.
    expect(todays(['00:00'])).toEqual(['14:00', '21:00']);
    expect(todays(['23:59'])).toEqual(['09:00', '14:00']);
  });

  it('says which part of the day an entry answers', () => {
    const slots = [{ at: 9 * 60 }, { at: 14 * 60 }, { at: 21 * 60 }];
    expect([0, 1, 2].map((index) => answered(slots, index, [14 * 60]))).toEqual([false, true, false]);
    expect([0, 1, 2].map((index) => answered(slots, index, [11 * 60]))).toEqual([true, false, false]);
    expect([0, 1, 2].map((index) => answered(slots, index, [12 * 60]))).toEqual([false, true, false]);
    expect([0, 1, 2].map((index) => answered(slots, index, []))).toEqual([false, false, false]);
    expect(answered([{ at: 20 * 60 + 30 }], 0, [23 * 60])).toBe(true);
    expect(answered([{ at: 20 * 60 + 30 }], 0, [0])).toBe(true);
  });

  it('skips nothing when the reminder should always come', () => {
    expect(todays(['08:00', '12:00', '18:00'], { always: true })).toEqual(['09:00', '14:00', '21:00']);
    expect(todays(['12:00'], { always: true, nowMinutes: 12 * 60 })).toEqual(['14:00', '21:00']);
  });

  it('never lets an entry of today touch the days after it', () => {
    const plan = daily({ times, nowMinutes: 6 * 60, entryDays: entries(0), entryTimes: new Map([[today, ['08:00', '12:00', '18:00']]]) });
    expect(plan).toHaveLength(3 * (REMINDER_DAYS - 1));
    expect(plan[0]!.date).toBe(day(1));
  });

  it('asks "Wie geht es dir gerade?" at every time, and "Wie war dein Tag?" only with a single one', () => {
    expect(daily({ times, nowMinutes: 0 }).every((r) => r.body === 'Wie geht es dir gerade?')).toBe(true);
    expect(daily({ times: ['21:00'] }).every((r) => r.body === 'Wie war dein Tag?')).toBe(true);
    expect(daily({ times, nowMinutes: 0 }).every((r) => r.title === 'Erinnerung')).toBe(true);
  });

  it('names the streak in the reminders of the next day that still has no entry, nowhere else', () => {
    const plan = daily({ times, nowMinutes: 6 * 60, entryDays: entries(-2, -1) });
    expect(plan.filter((r) => r.date === today).map((r) => r.body)).toEqual(Array(3).fill('Wie geht es dir gerade? Tag 3 deiner Serie.'));
    expect(plan.filter((r) => r.date !== today).every((r) => r.body === 'Wie geht es dir gerade?')).toBe(true);
  });

  it('drops the streak today once the day has an entry, and names tomorrow\'s, which cannot go stale any more', () => {
    const plan = daily({ times, nowMinutes: 6 * 60, entryDays: entries(-2, -1, 0), entryTimes: new Map([[today, ['08:00']]]) });
    const todays = plan.filter((r) => r.date === today);
    expect(todays.map((r) => formatTime(r.hour, r.minute))).toEqual(['14:00', '21:00']);
    expect(todays.every((r) => r.body === 'Wie geht es dir gerade?')).toBe(true);
    // The app may stay closed until then: tomorrow has no entry yet and rests on today's, which is there.
    expect(plan.filter((r) => r.date === day(1)).map((r) => r.body)).toEqual(Array(3).fill('Wie geht es dir gerade? Tag 4 deiner Serie.'));
    expect(plan.filter((r) => r.date > day(1)).every((r) => r.body === 'Wie geht es dir gerade?')).toBe(true);
  });

  it('keeps the streak out of tomorrow while today is still open', () => {
    const plan = daily({ times, nowMinutes: 10 * 60, entryDays: entries(-2, -1) });
    expect(plan.filter((r) => r.date === today).map((r) => r.body)).toEqual(Array(2).fill('Wie geht es dir gerade? Tag 3 deiner Serie.'));
    expect(plan.filter((r) => r.date !== today).every((r) => r.body === 'Wie geht es dir gerade?')).toBe(true);
  });

  it('names the streak tomorrow when nothing of today is left to come', () => {
    const plan = daily({ times, nowMinutes: 22 * 60, entryDays: entries(-1, 0), entryTimes: new Map([[today, ['08:00']]]) });
    expect(plan.filter((r) => r.date === day(1)).map((r) => r.body)).toEqual(Array(3).fill('Wie geht es dir gerade? Tag 3 deiner Serie.'));
    expect(plan.filter((r) => r.date !== day(1)).every((r) => r.body === 'Wie geht es dir gerade?')).toBe(true);
  });

  it('changes its signature when a time is added, moved or removed, and not with their order', () => {
    const signature = (list: string[]) => planSignature(planReminders(input({ times: list, nowMinutes: 0 })));
    const a = signature(times);
    expect(signature(['21:00', '14:00', '09:00'])).toBe(a);
    expect(signature([...times, '17:00'])).not.toBe(a);
    expect(signature(['09:00', '14:30', '21:00'])).not.toBe(a);
    expect(signature(['09:00', '21:00'])).not.toBe(a);
    // A removed time leaves no key behind: the plan, which replaces every alarm, no longer names it.
    expect(planReminders(input({ times: ['09:00', '21:00'], nowMinutes: 0 })).some((r) => r.key.endsWith('T14:00'))).toBe(false);
  });

  it('stays far below the number of alarms Android allows, at the most the app can plan', () => {
    const most = planReminders(
      input({
        times: ['07:00', '10:00', '13:00', '16:00', '21:00'],
        nowMinutes: 0,
        yesterdayEnabled: true,
        entryDays: entries(-2),
        outlook: { time: '08:00', hintDays: new Set([day(-1), today]) },
      }),
    );
    expect(most.filter((r) => r.kind === 'daily')).toHaveLength(5 * REMINDER_DAYS);
    expect(most.length).toBeGreaterThan(5 * REMINDER_DAYS);
    expect(most.length).toBeLessThan(100);
    expect(most.length).toBeLessThan(ANDROID_ALARM_LIMIT);
    expect(new Set(most.map((r) => r.key)).size).toBe(most.length);
  });
});

describe('a single time, as before', () => {
  it('stays away for any entry of the day, wherever its time lies', () => {
    for (const time of ['06:00', '20:30', '23:00']) {
      const plan = daily({ entryDays: entries(0), entryTimes: new Map([[today, [time]]]) });
      expect(plan[0]!.date).toBe(day(1));
    }
    // Also when the entries' times are not handed in at all.
    expect(daily({ entryDays: entries(0) })[0]!.date).toBe(day(1));
  });

  it('opens a new entry for its day', () => {
    expect(reminderLink(daily()[0]!)).toBe('daylight://entry/new?date=2026-09-26');
  });
});

describe('entryLink', () => {
  it('opens the editor for the day through the app scheme', () => {
    expect(entryLink(day(-1))).toBe('daylight://entry/new?date=2026-09-25');
  });
});
