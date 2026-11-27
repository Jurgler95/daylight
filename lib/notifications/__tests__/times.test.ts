import {
  addReminderTime,
  changeReminderTime,
  cleanReminderTimes,
  latestReminderTime,
  MAX_REMINDER_TIMES,
  reminderTimesOr,
  removeReminderTime,
  suggestReminderTime,
} from '../times';

describe('reminder times', () => {
  it('cleans a list: valid times only, none twice, sorted', () => {
    expect(cleanReminderTimes(['21:00', '09:00', '9:00', '25:00', '09:00', 7, null, '14:30'])).toEqual(['09:00', '14:30', '21:00']);
    expect(cleanReminderTimes('20:30')).toEqual([]);
    expect(cleanReminderTimes(undefined)).toEqual([]);
    expect(cleanReminderTimes([])).toEqual([]);
  });

  it('keeps the first five of a list that is too long', () => {
    const cleaned = cleanReminderTimes(['22:00', '08:00', '10:00', '12:00', '14:00', '16:00', '06:00']);
    expect(cleaned).toHaveLength(MAX_REMINDER_TIMES);
    expect(cleaned).toEqual(['08:00', '10:00', '12:00', '14:00', '22:00']);
  });

  it('falls back to the single time when nothing usable is left', () => {
    expect(reminderTimesOr(undefined, '21:15')).toEqual(['21:15']);
    expect(reminderTimesOr(['nope'], '21:15')).toEqual(['21:15']);
    expect(reminderTimesOr(['07:00', '19:00'], '21:15')).toEqual(['07:00', '19:00']);
    expect(reminderTimesOr(null, '')).toEqual(['20:30']);
  });

  it('names the latest time', () => {
    expect(latestReminderTime(['07:00', '19:00'])).toBe('19:00');
    expect(latestReminderTime([])).toBe('20:30');
  });

  it('adds a time in order, and refuses one that is there or a sixth', () => {
    expect(addReminderTime(['09:00', '21:00'], '14:00')).toEqual({ ok: true, times: ['09:00', '14:00', '21:00'] });
    expect(addReminderTime(['09:00', '21:00'], '21:00')).toEqual({ ok: false, reason: 'duplicate' });
    expect(addReminderTime(['06:00', '09:00', '12:00', '15:00', '18:00'], '21:00')).toEqual({ ok: false, reason: 'full' });
  });

  it('changes a time and sorts again, and refuses one the list already has', () => {
    expect(changeReminderTime(['09:00', '14:00', '21:00'], '09:00', '22:00')).toEqual({ ok: true, times: ['14:00', '21:00', '22:00'] });
    expect(changeReminderTime(['09:00', '14:00'], '09:00', '14:00')).toEqual({ ok: false, reason: 'duplicate' });
    expect(changeReminderTime(['09:00', '14:00'], '09:00', '09:00')).toEqual({ ok: true, times: ['09:00', '14:00'] });
  });

  it('removes a time, but never the last one', () => {
    expect(removeReminderTime(['09:00', '14:00'], '09:00')).toEqual({ ok: true, times: ['14:00'] });
    expect(removeReminderTime(['14:00'], '14:00')).toEqual({ ok: false, reason: 'last' });
  });

  it('suggests a time that is not taken yet', () => {
    expect(suggestReminderTime(['20:30'])).toBe('12:00');
    expect(suggestReminderTime(['12:00', '20:30'])).toBe('09:00');
  });
});
