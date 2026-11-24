import { addDaysToDateString, type DateString } from '@/lib/dates';

import {
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
} from '../plan';

const today = '2026-09-26' as DateString;
const day = (offset: number) => addDaysToDateString(today, offset);
/** Entries on the given offsets from today. */
const entries = (...offsets: number[]) => new Set<string>(offsets.map(day));

const wording: ReminderWording = {
  title: 'Erinnerung',
  daily: (n) => (n === null ? 'Wie war dein Tag?' : `Wie war dein Tag? Tag ${n} deiner Serie.`),
  yesterday: (n) => (n === null ? 'Gestern fehlt noch ein Eintrag.' : `Gestern fehlt noch. Trag es nach, dann bleiben deine ${n} Tage.`),
  outlook: 'Dein Ausblick für heute ist da',
};

const input = (overrides: Partial<PlanInput> = {}): PlanInput => ({
  today,
  nowMinutes: 12 * 60,
  enabled: true,
  time: '20:30',
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
      key: 'daily:2026-09-26',
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
    expect(planReminders(input({ time: '25:00' }))).toEqual([]);
    expect(planReminders(input({ time: '8:30' }))).toEqual([]);
  });

  it('changes its signature when the time, today or the text changes, not otherwise', () => {
    const a = planSignature(planReminders(input()));
    expect(planSignature(planReminders(input({ nowMinutes: 13 * 60 })))).toBe(a);
    expect(planSignature(planReminders(input({ time: '21:00' })))).not.toBe(a);
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
  it('names the evening of a day with an entry and the morning after it', () => {
    const keys = doneReminderKeys(entries(-1), today);
    expect(keys).toContain(`daily:${day(-1)}`);
    expect(keys).toContain(`yesterday:${day(0)}`);
    expect(keys).not.toContain(`daily:${day(0)}`);
  });

  it('looks back as far as reminders are planned', () => {
    expect(doneReminderKeys(entries(-(REMINDER_DAYS - 1)), today)).toEqual([`daily:${day(-(REMINDER_DAYS - 1))}`, `outlook:${day(-(REMINDER_DAYS - 1))}`, `yesterday:${day(-(REMINDER_DAYS - 2))}`]);
    expect(doneReminderKeys(entries(-REMINDER_DAYS - 1), today)).toEqual([]);
  });
});

describe('entryLink', () => {
  it('opens the editor for the day through the app scheme', () => {
    expect(entryLink(day(-1))).toBe('daylight://entry/new?date=2026-09-25');
  });
});
