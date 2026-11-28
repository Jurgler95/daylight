import { act, fireEvent, render, screen } from '@testing-library/react-native';

import '@/lib/i18n';
import type { Database } from '@/db';
import { createScale, listGroups, listScales } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';
import { useDataVersion } from '@/lib/store/dataVersion';

import GroupScreen from '../../../app/more/group/[id]';
import ScaleScreen from '../../../app/more/scale/[id]';

/** The switch "Beschreibt die Stimmung" on the page of a group and of a scale. */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  usePathname: () => '/more/group',
}));
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));

const LABEL = 'Beschreibt die Stimmung';

function use(db: Database) {
  mockDb = db;
  useDataVersion.getState().bump();
}

describe('the switch "Beschreibt die Stimmung"', () => {
  it('is on for the feelings group, off for the others, and writes the group', async () => {
    const db = createTestDb();
    use(db);
    const [feelings, sleep] = listGroups(db);
    mockParams = { id: String(sleep!.id) };
    await render(<GroupScreen />);
    expect(screen.getByLabelText(LABEL).props.value).toBe(false);
    expect(screen.getByText(/^Für Gruppen wie „Gefühle“/)).toBeTruthy();
    await act(async () => fireEvent(screen.getByLabelText(LABEL), 'valueChange', true));
    expect(screen.getByLabelText(LABEL).props.value).toBe(true);
    expect(listGroups(db).map((group) => group.describes_mood)).toEqual([true, true, false, false, false, false]);

    mockParams = { id: String(feelings!.id) };
    await render(<GroupScreen />);
    expect(screen.getByLabelText(LABEL).props.value).toBe(true);
    await act(async () => fireEvent(screen.getByLabelText(LABEL), 'valueChange', false));
    expect(listGroups(db)[0]!.describes_mood).toBe(false);
  });

  it('starts off on a scale and writes it', async () => {
    const db = createTestDb();
    use(db);
    const scale = createScale(db, { name: 'Zufriedenheit', min: 1, max: 5 });
    expect(scale.describes_mood).toBe(false);
    mockParams = { id: String(scale.id) };
    await render(<ScaleScreen />);
    expect(screen.getByText(/^Für Skalen, die die Stimmung selbst bewerten/)).toBeTruthy();
    await act(async () => fireEvent(screen.getByLabelText(LABEL), 'valueChange', true));
    expect(listScales(db)[0]!.describes_mood).toBe(true);
  });
});
