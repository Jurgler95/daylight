import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import '@/lib/i18n';
import type { Database } from '@/db';
import { createEntry, listActivities, listMoods } from '@/db/repositories';
import { replaceHealthDays, type HealthDayInput } from '@/db/repositories/health';
import { createScale, listScales } from '@/db/repositories/scales';
import { entryScales } from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import { applyDaylioImport } from '@/lib/daylio/apply';
import { parseDaylioCsv } from '@/lib/daylio/parse';
import { generateSample } from '@/lib/dev/generateSample';
import { applySample } from '@/lib/dev/sample';
import { resetLinks } from '@/lib/insights/useLinks';
import { useDataVersion } from '@/lib/store/dataVersion';

import ActivityInsightScreen from '../../../app/activity/[id]';
import InsightsScreen from '../../../app/(tabs)/insights';
import MoodInsightScreen from '../../../app/mood/[level]';
import ScaleInsightScreen from '../../../app/scale/[id]';

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

/** A second scale on the days with energy, running against it with a wobble, so scales can be compared with each other. */
function sampleStress(db: Database) {
  const stress = createScale(db, { name: 'Stress', min: 1, max: 5 });
  const energy = db.select().from(entryScales).all();
  if (energy.length) db.insert(entryScales).values(energy.map((row, i) => ({ entry_id: row.entry_id, scale_id: stress.id, value: Math.min(5, Math.max(1, 6 - row.value + (i % 3) - 1)) }))).run();
}

async function openTab(name: string) {
  await act(async () => fireEvent.press(screen.getByRole('tab', { name })));
}

const TABS: Record<string, (string | RegExp)[]> = {
  Stimmung: ['Verlauf', 'Verteilung', 'Jahr in Pixeln'],
  Muster: ['Wochentage', 'Monate', 'Schwankung', 'Serien'],
  Aktivitäten: ['Häufigkeit', 'Stabile Zusammenhänge', 'Oft zusammen', 'Vor schwierigen Tagen', /^Gruppenblick: /],
  Notizen: ['Überblick', 'Häufigste Wörter', 'Wörter', 'Umfang'],
};
/** The sample year records energy on most days; one scale alone has nothing for "Zusammenhänge". */
const SCALE_TABS: Record<string, (string | RegExp)[]> = {
  Skalen: ['Alle Skalen', 'Skalen an guten und schwierigen Tagen', 'Skalen und Stimmung'],
};
/** A scale's own page. */
const SCALE_DETAIL = ['Energie im Verlauf', 'Stimmung je Energie', 'Aktivitäten und Energie', 'Energie nach Wochentag'];
const HEALTH_TABS: Record<string, (string | RegExp)[]> = {
  Gesundheit: [/ im Verlauf$/, 'Ziele und Serien', / nach Wochentag$/, 'Bestwerte'],
  Zusammenhänge: [
    'Stimmung nach Schlaf und Bewegung',
    'Gute und schwierige Tage',
    'Stimmung und Körper',
    /^Aktivitäten und (Schlaf|Schritte|Puls|Training)$/,
    'Skalen untereinander',
    'Skalen und Körper',
  ],
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

  it('show how far a young diary is instead of empty cards, and each card only with enough days', async () => {
    const diary = (days: number) => {
      const db = createTestDb();
      const mood = listMoods(db).find((row) => row.level === 4)!;
      for (let i = 0; i < days; i++) createEntry(db, { date: addDaysToDateString(today, -i), time: '20:00', mood_id: mood.id });
      return db;
    };
    use(diary(1));
    const first = await render(<InsightsScreen />);
    expect(screen.getByText('Noch 6 Tage mit Eintrag, dann erscheinen erste Muster')).toBeTruthy();
    expect(screen.getByText('1 von 7 Tagen')).toBeTruthy();
    expect(screen.queryByText('Verteilung')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Muster' })).toBeNull();
    await first.unmount();

    // A week: the cards are there, the weekdays and months still say what they need.
    use(diary(7));
    await render(<InsightsScreen />);
    expect(screen.queryByText(/dann erscheinen erste Muster/)).toBeNull();
    expect(screen.getByText('Verteilung')).toBeTruthy();
    await openTab('Muster');
    expect(screen.getByText('Erscheint, sobald es in diesem Zeitraum 14 Tage mit Eintrag an mindestens 5 verschiedenen Wochentagen gibt.')).toBeTruthy();
    expect(screen.getByText('Erscheint, sobald 2 Monate in diesem Zeitraum Einträge haben.')).toBeTruthy();
  });

  it('render every card on the sample year in every range', async () => {
    const db = createTestDb();
    applySample(db, generateSample({ today }));
    use(db);
    await render(<InsightsScreen />);
    expect(screen.queryByRole('tab', { name: 'Gesundheit' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Zusammenhänge' })).toBeNull();
    for (const [tab, titles] of Object.entries({ ...TABS, ...SCALE_TABS })) {
      await openTab(tab);
      for (const title of titles) expect(screen.getByText(title)).toBeTruthy();
      await everyRange();
    }

    const energy = listScales(db).find((scale) => scale.name === 'Energie')!;
    mockParams = { id: String(energy.id), range: '365' };
    await render(<ScaleInsightScreen />);
    for (const title of SCALE_DETAIL) expect(screen.getByText(title)).toBeTruthy();
    await everyRange();

    const activity = listActivities(db)[0]!;
    mockParams = { id: String(activity.id) };
    await render(<ActivityInsightScreen />);
    expect(screen.getByText('Begleiter')).toBeTruthy();
    expect(screen.getByText('Skalen an diesen Tagen')).toBeTruthy();
    expect(screen.queryByText(/NaN|undefined|insights\./)).toBeNull();
    for (const level of ['1', '2', '3', '4', '5']) {
      mockParams = { level };
      await render(<MoodInsightScreen />);
      expect(screen.queryByText(/NaN|undefined|insights\./)).toBeNull();
    }
  });

  it('show the usual range per month and the tested links on the sample year', async () => {
    const db = createTestDb();
    applySample(db, generateSample({ today }));
    resetLinks();
    use(db);
    await render(<InsightsScreen />);
    await openTab('Muster');
    // Mostly "Gut": the range is that one level, and the days around it are what the months count.
    expect(screen.getByText('Dein üblicher Bereich: Gut')).toBeTruthy();
    expect(screen.getAllByText(/^\d+ darüber, \d+ darunter$/).length).toBeGreaterThan(0);

    // The links are worked out in slices after the section opened.
    await openTab('Aktivitäten');
    expect(screen.getByText('Wird berechnet')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Wird berechnet')).toBeNull());
    expect(screen.getByText('Am selben Tag')).toBeTruthy();
    expect(screen.getByText('STABILER ZUSAMMENHANG')).toBeTruthy();
    // The generator lifts the mood with good sleep and weighs it down with poor sleep.
    expect(screen.getByRole('button', { name: /^Gut \(Schlaf\)\. Geht mit besseren Tagen einher \(\d+ Tage\)$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Schlecht \(Schlaf\)\. Geht mit schlechteren Tagen einher \(\d+ Tage\)$/ })).toBeTruthy();
    // The feelings group is marked from the start, so its activities stand apart.
    expect(screen.getByText('Beschreibt die Stimmung')).toBeTruthy();
    // Only the first few at first; other cards of the section have a button of the same name.
    expect(screen.queryByRole('button', { name: /^Müde\. Geht mit / })).toBeNull();
    for (const button of screen.getAllByRole('button', { name: 'Alle zeigen' })) await act(async () => fireEvent.press(button));
    expect(screen.getByRole('button', { name: /^Müde\. Geht mit schlechteren Tagen einher \(\d+ Tage\)$/ })).toBeTruthy();
    expect(screen.queryByText(/NaN|undefined|insights\./)).toBeNull();
  });

  it('render the health tabs with watch data in every range', async () => {
    const db = createTestDb();
    applySample(db, generateSample({ today }));
    sampleHealth(db);
    sampleStress(db);
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

    // Two scales: the list names both, each opening its own page.
    await openTab('Skalen');
    expect(screen.getByRole('button', { name: /^Energie\. / })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Stress\. / })).toBeTruthy();
    expect(screen.queryByText('Stress im Verlauf')).toBeNull();
    const stress = listScales(db).find((scale) => scale.name === 'Stress')!;
    mockParams = { id: String(stress.id) };
    await render(<ScaleInsightScreen />);
    expect(screen.getByText('Stress im Verlauf')).toBeTruthy();
    expect(screen.getByText('Stress nach Wochentag')).toBeTruthy();
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
