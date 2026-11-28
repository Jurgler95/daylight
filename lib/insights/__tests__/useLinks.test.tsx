import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { Database } from '@/db';
import { createActivity, createEntry, createScale, listGroups, listMoods, updateActivity, updateGroup, updateScale } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import { mutate, useDataVersion } from '@/lib/store/dataVersion';

import { linksSteps } from '../links';
import { resetLinks, useLinks } from '../useLinks';

/**
 * The bridge between the diary and the links: computed once per distinct diary outside rendering,
 * again when a mark changes, and not at all while nobody looks.
 */
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));
jest.mock('../links', () => {
  const actual = jest.requireActual('../links');
  return { ...actual, linksSteps: jest.fn(actual.linksSteps) };
});

const today = '2026-09-26' as DateString;
const runs = () => jest.mocked(linksSteps).mock.calls.length;

/** Sixty days: "Froh" (feelings) on the good days, "Sport" on every third day, a scale that follows the mood. */
function diary() {
  const db = createTestDb();
  const [feelings, sleep] = listGroups(db);
  const glad = createActivity(db, { group_id: feelings!.id, name: 'Froh' });
  const sport = createActivity(db, { group_id: sleep!.id, name: 'Sport' });
  const calm = createScale(db, { name: 'Ruhe', min: 1, max: 5 });
  const moods = new Map(listMoods(db).map((mood) => [mood.level, mood.id]));
  for (let i = 0; i < 60; i++) {
    const good = (i * 7) % 5 < 2;
    const level = good ? (i % 2 ? 5 : 4) : i % 3 ? 3 : 2;
    createEntry(db, {
      date: addDaysToDateString(today, -i),
      time: '20:00',
      mood_id: moods.get(level)!,
      activity_ids: [...(good ? [glad.id] : []), ...(i % 3 === 0 ? [sport.id] : [])],
      scales: [{ scale_id: calm.id, value: level }],
    });
  }
  return { db, feelings: feelings!, glad, sport, calm };
}

async function mounted(db: Database, active = true) {
  mockDb = db;
  await act(async () => {
    resetLinks();
    useDataVersion.getState().bump();
  });
  jest.mocked(linksSteps).mockClear();
  return renderHook(() => useLinks(useCatalog(), today, active));
}

describe('useLinks', () => {
  it('computes once, lists what the feelings group holds apart, and stays put while nothing it depends on changes', async () => {
    const { db, glad, sport } = diary();
    const view = await mounted(db);
    expect(view.result.current).toBeNull();
    await waitFor(() => expect(view.result.current).not.toBeNull());
    expect(runs()).toBe(1);
    expect(view.result.current).toMatchObject({ days: 60 });
    expect(view.result.current!.describing).toContainEqual(expect.objectContaining({ factor: { kind: 'activity', id: glad.id }, lag: 0, direction: 'up' }));
    expect(view.result.current!.findings.some((finding) => finding.factor.kind === 'activity' && finding.factor.id === glad.id)).toBe(false);

    // A write that changes no day, no value and no mark: a new name is not part of the signature.
    const before = view.result.current;
    await act(async () => mutate(() => updateActivity(db, sport.id, { name: 'Laufen' })));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
    expect(runs()).toBe(1);
    expect(view.result.current).toBe(before);
  });

  it('computes again when the mark of a group or a scale changes', async () => {
    const { db, feelings, glad, calm } = diary();
    const view = await mounted(db);
    await waitFor(() => expect(view.result.current).not.toBeNull());
    expect(runs()).toBe(1);

    await act(async () => mutate(() => updateGroup(db, feelings.id, { describes_mood: false })));
    await waitFor(() => expect(view.result.current!.describing).toEqual([]));
    expect(runs()).toBe(2);
    expect(view.result.current!.findings).toContainEqual(expect.objectContaining({ factor: { kind: 'activity', id: glad.id }, lag: 0, direction: 'up' }));

    await act(async () => mutate(() => updateScale(db, calm.id, { describes_mood: true })));
    await waitFor(() => expect(view.result.current!.describing).toContainEqual(expect.objectContaining({ factor: { kind: 'scale', id: calm.id }, lag: 0 })));
    expect(runs()).toBe(3);
  });

  it('computes nothing while its section is closed', async () => {
    const view = await mounted(diary().db, false);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
    expect(view.result.current).toBeNull();
    expect(runs()).toBe(0);
  });
  it('ends on the diary it was last given when a mark is switched off and on again mid-run', async () => {
    const { db, feelings, glad } = diary();
    const view = await mounted(db);
    const listed = () => view.result.current!.describing.some((finding) => finding.factor.kind === 'activity' && finding.factor.id === glad.id);
    await waitFor(() => expect(view.result.current).not.toBeNull());
    expect(listed()).toBe(true);
    await act(async () => {
      mutate(() => updateGroup(db, feelings.id, { describes_mood: false }));
    });
    await act(async () => {
      mutate(() => updateGroup(db, feelings.id, { describes_mood: true }));
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(listed()).toBe(true);
  });
});
