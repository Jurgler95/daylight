import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { applyLanguage } from '@/lib/i18n';
import type { DateString } from '@/lib/dates';

import { LevelBar } from '../../LevelBar';
import { MiniBars } from '../../MiniBars';
import { MoodLineChart } from '../../MoodLineChart';
import { nearestIndex } from '../useInspector';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/db/client', () => ({ getDb: () => require('@/db/testDb').createTestDb(), DATABASE_NAME: 'test.db' }));

const WINDOW = { from: '2026-11-01' as DateString, to: '2026-11-11' as DateString };
const touch = (x: number, y = 10) => ({ nativeEvent: { locationX: x, locationY: y } });
const layout = (width: number, height = 150) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });

describe('nearestIndex', () => {
  it('finds the closest x, preferring the earlier one on a tie', () => {
    expect(nearestIndex([], 5)).toBeNull();
    expect(nearestIndex([10, 20, 30], -4)).toBe(0);
    expect(nearestIndex([10, 20, 30], 24)).toBe(1);
    expect(nearestIndex([10, 20, 30], 25)).toBe(1);
    expect(nearestIndex([10, 20, 30], 26)).toBe(2);
    expect(nearestIndex([10, 20, 30], 99)).toBe(2);
  });
});

describe('tapping charts', () => {
  beforeAll(() => applyLanguage('de'));

  it('shows the day under the finger on the mood trend, and lets it go on a second tap', async () => {
    const points = [
      { date: '2026-11-01' as DateString, mean: 2, rolling: 2 },
      { date: '2026-11-05' as DateString, mean: 4, rolling: 3 },
      { date: '2026-11-11' as DateString, mean: 5, rolling: 3.5 },
    ];
    await render(<MoodLineChart points={points} window={WINDOW} mean={3.7} iconFor={() => 'emoticon-outline'} />);
    const plot = screen.getAllByRole('image')[0]!;
    await act(async () => fireEvent(plot, 'layout', layout(242)));
    // Plot from 34 to 234 px over 10 days: 5 November sits at 114.
    await act(async () => {
      fireEvent(plot, 'responderGrant', touch(118));
      fireEvent(plot, 'responderRelease', touch(118));
    });
    expect(screen.getByText('7-Tage-Mittel 3,0')).toBeTruthy();
    expect(screen.getByText('4,0')).toBeTruthy();
    // Dragging moves on to the next day.
    await act(async () => {
      fireEvent(plot, 'responderGrant', touch(118));
      fireEvent(plot, 'responderMove', touch(230));
      fireEvent(plot, 'responderRelease', touch(230));
    });
    expect(screen.getByText('7-Tage-Mittel 3,5')).toBeTruthy();
    await act(async () => {
      fireEvent(plot, 'responderGrant', touch(230));
      fireEvent(plot, 'responderRelease', touch(230));
    });
    expect(screen.queryByText(/^7-Tage-Mittel \d/)).toBeNull();
  });

  it('opens the trend large', async () => {
    await render(<MoodLineChart points={[]} window={WINDOW} mean={null} iconFor={() => 'emoticon-outline'} title="Im Experiment" />);
    await act(async () => fireEvent.press(screen.getByLabelText('Groß anzeigen')));
    expect(screen.getByText('Im Experiment')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByLabelText('Schließen')));
    expect(screen.queryByText('Im Experiment')).toBeNull();
  });

  it('names a bar when tapped', async () => {
    await render(<MiniBars values={[0.5, 1]} labels={['Mo', 'Di']} details={['Mo: 3 Tage', 'Di: 6 Tage']} accessibilityLabel="Wochentage" />);
    const bars = screen.getByLabelText('Wochentage').children[0] as never;
    await act(async () => fireEvent(bars, 'layout', layout(200, 64)));
    await act(async () => {
      fireEvent(bars, 'responderGrant', touch(150));
      fireEvent(bars, 'responderRelease', touch(150));
    });
    expect(screen.getByText('Di: 6 Tage')).toBeTruthy();
    expect(screen.queryByText('Mo: 3 Tage')).toBeNull();
  });

  it('names the mood of the tapped part of a stacked bar', async () => {
    await render(
      <LevelBar
        label="Mit"
        levels={[
          { level: 5, days: 3, share: 0.25 },
          { level: 3, days: 9, share: 0.75 },
        ]}
        moodLabel={(level) => (level === 5 ? 'Super' : 'Okay')}
      />,
    );
    const row = screen.getByLabelText(/^Mit:/).children[0] as { children: unknown[] };
    const bar = row.children[1] as never;
    await act(async () => fireEvent(bar, 'layout', layout(200, 14)));
    await act(async () => {
      fireEvent(bar, 'responderGrant', touch(120));
      fireEvent(bar, 'responderRelease', touch(120));
    });
    expect(screen.getByText('Okay · 75 % · 9 Tage')).toBeTruthy();
  });
});
