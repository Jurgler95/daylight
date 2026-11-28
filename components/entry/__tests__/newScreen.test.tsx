import { render } from '@testing-library/react-native';

import type { Database } from '@/db';
import { createEntry, listMoods } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';
import { useDataVersion } from '@/lib/store/dataVersion';

import NewEntryScreen from '../../../app/entry/new';

/** `/entry/new` always opens a new entry, also for a day that already has one. */
const mockEditor = jest.fn((_props: { target: unknown }) => null);
jest.mock('@/components/entry/EntryEditor', () => ({ EntryEditor: (props: { target: unknown }) => mockEditor(props) }));
let mockParams: { date?: string; mood?: string; resume?: string } = {};
const mockRedirect = jest.fn(() => null);
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, Redirect: () => mockRedirect() }));
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));
jest.mock('@/lib/dates/useToday', () => ({ useToday: () => '2026-09-26' }));

describe('/entry/new', () => {
  let mood: number;
  beforeEach(() => {
    mockDb = createTestDb();
    useDataVersion.getState().bump();
    mood = listMoods(mockDb)[1]!.id;
    mockEditor.mockClear();
    mockRedirect.mockClear();
  });

  it('opens a new entry on a day that already has one instead of that entry', async () => {
    createEntry(mockDb!, { date: '2026-09-26', time: '08:00', mood_id: mood });
    mockParams = { date: '2026-09-26' };
    await render(<NewEntryScreen />);
    expect(mockEditor).toHaveBeenCalledWith({ target: { kind: 'new', date: '2026-09-26', moodId: null, resume: false } });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('takes the mood a widget hands over, for today, also with entries there', async () => {
    createEntry(mockDb!, { date: '2026-09-26', time: '08:00', mood_id: mood });
    mockParams = { mood: String(mood) };
    await render(<NewEntryScreen />);
    expect(mockEditor).toHaveBeenCalledWith({ target: { kind: 'new', date: '2026-09-26', moodId: mood, resume: false } });
  });

  it('opens on the saved draft when the offer on start sent it here', async () => {
    mockParams = { date: '2026-09-25', resume: '1' };
    await render(<NewEntryScreen />);
    expect(mockEditor).toHaveBeenCalledWith({ target: { kind: 'new', date: '2026-09-25', moodId: null, resume: true } });
  });

  it('falls back to today for a day ahead and ignores a mood it does not know', async () => {
    mockParams = { date: '2026-09-27', mood: '9999' };
    await render(<NewEntryScreen />);
    expect(mockEditor).toHaveBeenCalledWith({ target: { kind: 'new', date: '2026-09-26', moodId: null, resume: false } });
  });
});
