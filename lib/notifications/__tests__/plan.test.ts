import type { DateString } from '@/lib/dates';

import { formatTime, parseTime, planReminders, planSignature, REMINDER_DAYS, type PlanInput } from '../plan';

const today = '2026-09-26' as DateString;
const input = (overrides: Partial<PlanInput> = {}): PlanInput => ({
  today,
  nowMinutes: 12 * 60,
  enabled: true,
  time: '20:30',
  hasEntryToday: false,
  ...overrides,
});

describe('planReminders', () => {
  it('plans nothing while the reminder is off', () => {
    expect(planReminders(input({ enabled: false }))).toEqual([]);
  });

  it('plans one reminder a day at the chosen time, starting today', () => {
    const plan = planReminders(input());
    expect(plan).toHaveLength(REMINDER_DAYS);
    expect(plan[0]).toEqual({ key: 'daily:2026-09-26', date: '2026-09-26', hour: 20, minute: 30 });
    expect(plan[1]).toMatchObject({ date: '2026-09-27', hour: 20, minute: 30 });
    expect(plan[REMINDER_DAYS - 1]!.date).toBe('2026-10-09');
  });

  it('drops today once there is an entry', () => {
    const plan = planReminders(input({ hasEntryToday: true }));
    expect(plan).toHaveLength(REMINDER_DAYS - 1);
    expect(plan[0]!.date).toBe('2026-09-27');
  });

  it('drops today once the time has passed, and keeps it while it is ahead', () => {
    expect(planReminders(input({ nowMinutes: 20 * 60 + 30 }))[0]!.date).toBe('2026-09-27');
    expect(planReminders(input({ nowMinutes: 20 * 60 + 29 }))[0]!.date).toBe('2026-09-26');
  });

  it('ignores an invalid time instead of throwing', () => {
    expect(planReminders(input({ time: '25:00' }))).toEqual([]);
    expect(planReminders(input({ time: '8:30' }))).toEqual([]);
  });

  it('changes its signature when the time or today changes, not otherwise', () => {
    const a = planSignature(planReminders(input()));
    expect(planSignature(planReminders(input({ nowMinutes: 13 * 60 })))).toBe(a);
    expect(planSignature(planReminders(input({ time: '21:00' })))).not.toBe(a);
    expect(planSignature(planReminders(input({ hasEntryToday: true })))).not.toBe(a);
  });

  it('parses and formats "HH:mm"', () => {
    expect(parseTime('07:05')).toEqual({ hour: 7, minute: 5 });
    expect(parseTime('24:00')).toBeNull();
    expect(formatTime(7, 5)).toBe('07:05');
  });
});
