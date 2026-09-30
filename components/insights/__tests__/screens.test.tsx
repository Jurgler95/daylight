import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import '@/lib/i18n';
import type { Database } from '@/db';
import { listActivities } from '@/db/repositories';
import { replaceHealthDays, type HealthDayInput } from '@/db/repositories/health';
import { createTestDb } from '@/db/testDb';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import { applyDaylioImport } from '@/lib/daylio/apply';
import { parseDaylioCsv } from '@/lib/daylio/parse';
import { generateSample } from '@/lib/dev/generateSample';
import { applySample } from '@/lib/dev/sample';
import { useDataVersion } from '@/lib/store/dataVersion';

import ActivityInsightScreen from '../../../app/activity/[id]';
import InsightsScreen from '../../../app/(tabs)/insights';
import MoodInsightScreen from '../../../app/mood/[level]';

/**
 * Renders the insight screens against an empty diary, the sample year and (when present) the real
 * export, so a NaN, a crash or a missing text key shows up without a device. Layout, charts and
 * touch are only checked on the phone. Output of the real-data run is never printed.
 */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// Icon fonts need expo-asset, which the test environment does not load; icons draw nothing here.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
// Ships untranspiled ESM; the chart library is only checked on the device.
jest.mock('react-native-gifted-charts', () => ({ BarChart: () => null }));
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));
jest.mock('@/lib/dates/useToday', () => ({ useToday: () => '2026-09-26' }));

const today = '2026-09-26' as DateString;
const FILE = path.join(__dirname, '..', '..', '..', 'private', 'daylio_export_2026_09_26.csv');

function use(db: Database) {
  mockDb = db;
  // Every cached read belongs to the previous database; nothing is mounted yet, so no act().
  useDataVersion.getState().bump();
}

/** A year of plausible watch data, deterministic, so the health tabs have something to show. */
function sampleHealth(db: Database) {
  const rows: HealthDayInput[] = [];
  for (let i = 0; i < 365; i++) {
    const wave = Math.sin(i * 1.7) + Math.cos(i * 0.37);
    rows.push({
      date: addDaysToDateString(today, -i),
      steps: Math.round(7500 + wave * 3000),
      sleep_minutes: i % 11 === 0 ? null : Math.round(420 + wave * 50),
      resting_hr: Math.round(60 + Math.sin(i * 0.9) * 3),
      exercise_minutes: i % 3 === 0 ? 30 + (i % 40) : null,
    });
  }
  replaceHealthDays(db, addDaysToDateString(today, -364), today, rows);
}

async function openTab(name: string) {
  await act(async () => fireEvent.press(screen.getByRole('tab', { name })));
}

const TABS: Record<string, string[]> = {
  Stimmung: ['Verlauf', 'Verteilung', 'Jahr in Pixeln'],
  Muster: ['Wochentage', 'Monate', 'Schwankung', 'Serien'],
  Aktivitäten: ['Häufigkeit', 'Stimmung mit und ohne', 'Am Folgetag', 'Oft zusammen', 'Vor schwierigen Tagen', 'Gruppenblick'],
  Notizen: ['Wörter', 'Umfang'],
};
const HEALTH_TABS: Record<string, string[]> = {
  Gesundheit: ['Verlauf der Werte', 'Ziele und Serien', 'Werte nach Wochentag', 'Bestwerte'],
  Zusammenhänge: ['Stimmung nach Schlaf und Bewegung', 'Gute und schwierige Tage', 'Stimmung und Körper', 'Aktivitäten und Körper'],
};

async function everyRange() {
  for (const label of ['30 Tage', '90 Tage', 'Jahr', 'Alles']) {
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: label })));
    expect(screen.queryByText(/NaN|undefined|insights\./)).toBeNull();
  }
}

describe('insight screens', () => {
  it('show one empty state without entries', async () => {
    use(createTestDb());
    await render(<InsightsScreen />);
    expect(screen.getByText('Einblicke folgen, sobald Einträge da sind')).toBeTruthy();
    mockParams = { level: '4' };
    await render(<MoodInsightScreen />);
    expect(screen.getByText('Noch kein Tag mit dieser Stimmung')).toBeTruthy();
  });

  it('render every card on the sample year in every range', async () => {
    const db = createTestDb();
    applySample(db, generateSample({ today }));
    use(db);
    await render(<InsightsScreen />);
    expect(screen.queryByRole('tab', { name: 'Gesundheit' })).toBeNull();
    for (const [tab, titles] of Object.entries(TABS)) {
      await openTab(tab);
      for (const title of titles) expect(screen.getByText(title)).toBeTruthy();
      await everyRange();
    }

    const activity = listActivities(db)[0]!;
    mockParams = { id: String(activity.id) };
    await render(<ActivityInsightScreen />);
    expect(screen.getByText('Begleiter')).toBeTruthy();
    expect(screen.queryByText(/NaN|undefined|insights\./)).toBeNull();
    for (const level of ['1', '2', '3', '4', '5']) {
      mockParams = { level };
      await render(<MoodInsightScreen />);
      expect(screen.queryByText(/NaN|undefined|insights\./)).toBeNull();
    }
  });

  it('render the health tabs with watch data in every range', async () => {
    const db = createTestDb();
    applySample(db, generateSample({ today }));
    sampleHealth(db);
    use(db);
    await render(<InsightsScreen />);
    for (const [tab, titles] of Object.entries(HEALTH_TABS)) {
      await openTab(tab);
      for (const title of titles) expect(screen.getByText(title)).toBeTruthy();
      await everyRange();
    }
    await openTab('Gesundheit');
    for (const metric of ['Schritte', 'Puls', 'Training']) {
      await act(async () => fireEvent.press(screen.getAllByRole('radio', { name: metric })[0]!));
      expect(screen.queryByText(/NaN|undefined|insights\./)).toBeNull();
    }
  });

  (existsSync(FILE) ? it : it.skip)('render every card on the real export (private/)', async () => {
    const db = createTestDb();
    applyDaylioImport(db, parseDaylioCsv(readFileSync(FILE, 'utf8')), { mode: 'merge' });
    use(db);
    await render(<InsightsScreen />);
    for (const tab of Object.keys(TABS)) {
      await openTab(tab);
      await everyRange();
    }
    const family = listActivities(db).find((a) => a.name === 'Familie')!;
    mockParams = { id: String(family.id) };
    await render(<ActivityInsightScreen />);
    expect(screen.queryByText(/NaN|undefined|insights\./)).toBeNull();
    expect(screen.getByText(/An Tagen mit Familie im Schnitt 4,1 statt 3,9 \(79 Tage\)/)).toBeTruthy();
  });
});
