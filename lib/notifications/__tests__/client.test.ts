import type { DateString } from '@/lib/dates';

import { setReminderMoods, syncReminders } from '../client';
import type { PlannedReminder } from '../plan';

jest.mock('@/modules/daylight-reminders', () => ({
  __esModule: true,
  default: { createChannel: jest.fn(), cancelAll: jest.fn(), schedule: jest.fn(), setMoods: jest.fn(), dismiss: jest.fn() },
}));

const Reminders = jest.requireMock('@/modules/daylight-reminders').default as Record<string, jest.Mock>;

const reminder = (kind: PlannedReminder['kind'], date: string, openDate: string | null): PlannedReminder => ({
  key: `${kind}:${date}`,
  kind,
  date: date as DateString,
  hour: 20,
  minute: 30,
  openDate: openDate as DateString | null,
  title: 'Erinnerung',
  body: 'Wie war dein Tag?',
});

describe('syncReminders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('hands each reminder the link behind its mood buttons, none for the outlook', async () => {
    await syncReminders(
      [reminder('daily', '2026-11-27', '2026-11-27'), reminder('yesterday', '2026-11-28', '2026-11-27'), reminder('outlook', '2026-11-28', null)],
      'Erinnerung',
    );
    const moodUrls = Reminders.schedule!.mock.calls.map((call) => call[7]);
    expect(moodUrls).toEqual(['daylight://entry/new?date=2026-11-27', 'daylight://entry/new?date=2026-11-27', null]);
  });
});

describe('setReminderMoods', () => {
  it('hands the moods over as JSON', async () => {
    const moods = { font: null, moods: [{ id: 1, level: 5, glyph: 0, label: 'Super' }] };
    await setReminderMoods(moods);
    expect(JSON.parse(Reminders.setMoods!.mock.calls[0]![0] as string)).toEqual(moods);
  });
});
