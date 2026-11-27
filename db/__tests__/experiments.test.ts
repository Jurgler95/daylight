import type { DateString } from '@/lib/dates';
import { checkInCounts } from '@/lib/experiments/compare';
import { experimentState } from '@/lib/experiments/rules';

import {
  clearJournal,
  createExperiment,
  deleteExperiment,
  endExperiment,
  experimentAnswersOn,
  getExperiment,
  listExperimentDays,
  listExperiments,
  markExperimentSeen,
  setExperimentDays,
  updateExperiment,
} from '../repositories';
import { createTestDb } from '../testDb';

const today = '2026-11-27' as DateString;

describe('experiments', () => {
  it('creates one from start and length, trimmed, with the end inclusive', () => {
    const db = createTestDb();
    const experiment = createExperiment(db, { title: '  Kein Kaffee nach 14 Uhr ', note: ' ', start_date: '2026-12-01', days: 28 }, today);
    expect(experiment).toMatchObject({ title: 'Kein Kaffee nach 14 Uhr', note: null, start_date: '2026-12-01', end_date: '2026-12-28', check_in: false, result_seen: false });
    expect(listExperiments(db)).toHaveLength(1);
  });

  it('refuses titles, lengths and starts outside the rules', () => {
    const db = createTestDb();
    expect(() => createExperiment(db, { title: ' ', start_date: '2026-12-01', days: 28 }, today)).toThrow('title');
    expect(() => createExperiment(db, { title: 'x'.repeat(61), start_date: '2026-12-01', days: 28 }, today)).toThrow('title');
    expect(() => createExperiment(db, { title: 'A', start_date: '2026-12-01', days: 6 }, today)).toThrow('length');
    expect(() => createExperiment(db, { title: 'A', start_date: '2026-12-01', days: 85 }, today)).toThrow('length');
    expect(() => createExperiment(db, { title: 'A', start_date: '2025-11-26', days: 28 }, today)).toThrow('startTooEarly');
    expect(() => createExperiment(db, { title: 'A', start_date: '2027-01-27', days: 28 }, today)).toThrow('startTooLate');
    expect(() => createExperiment(db, { title: 'A', start_date: '2026-13-01', days: 28 }, today)).toThrow();
    expect(listExperiments(db)).toEqual([]);
  });

  it('counts one that is already over as seen, so "Heute" shows no card for it', () => {
    const db = createTestDb();
    expect(createExperiment(db, { title: 'Alt', start_date: '2026-10-01', days: 28 }, today).result_seen).toBe(true);
    // Ends today: still running.
    expect(createExperiment(db, { title: 'Läuft', start_date: '2026-10-31', days: 28 }, today).result_seen).toBe(false);
  });

  it('edits title, note and switch at any time, the dates only while not over', () => {
    const db = createTestDb();
    const over = createExperiment(db, { title: 'Alt', start_date: '2026-10-01', days: 28 }, today);
    expect(updateExperiment(db, over.id, { title: 'Älter', note: 'warum', check_in: true }, today)).toMatchObject({ title: 'Älter', note: 'warum', check_in: true });
    expect(() => updateExperiment(db, over.id, { dates: { start_date: '2026-11-20', days: 28 } }, today)).toThrow('over');
    expect(() => updateExperiment(db, over.id, { title: '' }, today)).toThrow('title');

    const running = createExperiment(db, { title: 'Läuft', start_date: '2026-11-20', days: 28 }, today);
    // Ending before today only goes through "Jetzt beenden".
    expect(() => updateExperiment(db, running.id, { dates: { start_date: '2026-11-10', days: 14 } }, today)).toThrow('endBeforeToday');
    expect(updateExperiment(db, running.id, { dates: { start_date: '2026-11-15', days: 14 } }, today)).toMatchObject({ start_date: '2026-11-15', end_date: '2026-11-28' });
  });

  it('removes answers outside a new span when the dates change', () => {
    const db = createTestDb();
    const experiment = createExperiment(db, { title: 'A', start_date: '2026-11-20', days: 28, check_in: true }, today);
    setExperimentDays(db, '2026-11-20', { [experiment.id]: true }, today);
    setExperimentDays(db, '2026-11-25', { [experiment.id]: true }, today);
    updateExperiment(db, experiment.id, { dates: { start_date: '2026-11-22', days: 14 } }, today);
    expect(listExperimentDays(db, experiment.id).map((row) => row.date)).toEqual(['2026-11-25']);
  });

  it('ends a running one yesterday and drops later answers, not on the start day', () => {
    const db = createTestDb();
    const running = createExperiment(db, { title: 'A', start_date: '2026-11-20', days: 28, check_in: true }, today);
    setExperimentDays(db, '2026-11-26', { [running.id]: true }, today);
    setExperimentDays(db, '2026-11-27', { [running.id]: true }, today);
    expect(endExperiment(db, running.id, today).end_date).toBe('2026-11-26');
    expect(listExperimentDays(db, running.id).map((row) => row.date)).toEqual(['2026-11-26']);

    // On the start day there is nothing to end; it is deleted instead.
    const fresh = createExperiment(db, { title: 'B', start_date: today, days: 7 }, today);
    expect(() => endExperiment(db, fresh.id, today)).toThrow('not running');

    const planned = createExperiment(db, { title: 'C', start_date: '2026-12-01', days: 7 }, today);
    expect(() => endExperiment(db, planned.id, today)).toThrow('not running');
    expect(() => endExperiment(db, running.id, today)).toThrow('not running');
  });

  it('deletes with its answers', () => {
    const db = createTestDb();
    const experiment = createExperiment(db, { title: 'A', start_date: '2026-11-20', days: 28, check_in: true }, today);
    setExperimentDays(db, '2026-11-21', { [experiment.id]: true }, today);
    deleteExperiment(db, experiment.id);
    expect(getExperiment(db, experiment.id)).toBeUndefined();
    expect(listExperimentDays(db)).toEqual([]);
  });

  it('refuses a second one with the same folded title and start, also by editing', () => {
    const db = createTestDb();
    const first = createExperiment(db, { title: 'Kein Kaffee', start_date: '2026-12-01', days: 28 }, today);
    expect(() => createExperiment(db, { title: ' kein kaffee ', start_date: '2026-12-01', days: 14 }, today)).toThrow('duplicate');
    const other = createExperiment(db, { title: 'Kein Kaffee', start_date: '2026-12-02', days: 28 }, today);
    expect(() => updateExperiment(db, other.id, { dates: { start_date: '2026-12-01', days: 28 } }, today)).toThrow('duplicate');
    const third = createExperiment(db, { title: 'Tee', start_date: '2026-12-01', days: 28 }, today);
    expect(() => updateExperiment(db, third.id, { title: 'KEIN KAFFEE' }, today)).toThrow('duplicate');
    // Its own key is no duplicate.
    expect(updateExperiment(db, first.id, { title: 'Kein Kaffee!' }, today).title).toBe('Kein Kaffee!');
  });

  it('marks the result seen once', () => {
    const db = createTestDb();
    const experiment = createExperiment(db, { title: 'A', start_date: '2026-11-01', days: 21 }, today);
    markExperimentSeen(db, experiment.id);
    expect(getExperiment(db, experiment.id)!.result_seen).toBe(true);
  });

  describe('answers', () => {
    it('sets, changes and takes back answers for days in the span, not after today', () => {
      const db = createTestDb();
      const a = createExperiment(db, { title: 'A', start_date: '2026-11-20', days: 28, check_in: true }, today);
      const b = createExperiment(db, { title: 'B', start_date: '2026-11-25', days: 28, check_in: true }, today);
      setExperimentDays(db, '2026-11-26', { [a.id]: true, [b.id]: true }, today);
      expect(experimentAnswersOn(db, '2026-11-26')).toEqual(new Map([[a.id, true], [b.id, true]]));
      setExperimentDays(db, '2026-11-26', { [b.id]: null }, today);
      expect(experimentAnswersOn(db, '2026-11-26')).toEqual(new Map([[a.id, true]]));

      expect(() => setExperimentDays(db, '2026-11-28', { [a.id]: true }, today)).toThrow('no answer');
      expect(() => setExperimentDays(db, '2026-11-24', { [b.id]: true }, today)).toThrow('no answer');
      // A failed save writes nothing, not even the valid part.
      expect(() => setExperimentDays(db, '2026-11-24', { [a.id]: true, [b.id]: true }, today)).toThrow();
      expect(experimentAnswersOn(db, '2026-11-24').size).toBe(0);
    });

    it('a "no" ends the experiment the day before, keeps the "no" and drops later answers', () => {
      const db = createTestDb();
      const experiment = createExperiment(db, { title: 'A', start_date: '2026-11-10', days: 28, check_in: true }, today);
      setExperimentDays(db, '2026-11-20', { [experiment.id]: true }, today);
      setExperimentDays(db, '2026-11-25', { [experiment.id]: true }, today);
      setExperimentDays(db, '2026-11-26', { [experiment.id]: true }, today);
      setExperimentDays(db, '2026-11-24', { [experiment.id]: false }, today);
      expect(getExperiment(db, experiment.id)!.end_date).toBe('2026-11-23');
      expect(listExperimentDays(db, experiment.id).map((row) => [row.date, row.kept])).toEqual([
        ['2026-11-20', true],
        ['2026-11-24', false],
      ]);
    });

    it('a "no" on the start day ends it on the start day', () => {
      const db = createTestDb();
      const experiment = createExperiment(db, { title: 'A', start_date: today, days: 14, check_in: true }, today);
      setExperimentDays(db, today, { [experiment.id]: false }, today);
      const ended = getExperiment(db, experiment.id)!;
      expect(ended.end_date).toBe(today);
      expect(listExperimentDays(db, experiment.id)).toHaveLength(1);
      // Over at once: no more answers, no "Jetzt beenden", no new dates.
      expect(experimentState(ended, today)).toBe('over');
      expect(() => setExperimentDays(db, today, { [experiment.id]: true }, today)).toThrow('no answer');
      expect(() => endExperiment(db, experiment.id, today)).toThrow('not running');
      expect(() => updateExperiment(db, experiment.id, { dates: { start_date: today, days: 14 } }, today)).toThrow('over');
      expect(checkInCounts(ended, listExperimentDays(db, experiment.id)).endedByNo).toBe(today);
    });

    it('takes no answer once it is over, so the result stays (E17); taking one back still works', () => {
      const db = createTestDb();
      const experiment = createExperiment(db, { title: 'A', start_date: '2026-11-01', days: 21, check_in: true }, '2026-11-01' as DateString);
      setExperimentDays(db, '2026-11-10', { [experiment.id]: true }, '2026-11-10' as DateString);
      expect(() => setExperimentDays(db, '2026-11-12', { [experiment.id]: false }, today)).toThrow('no answer');
      expect(() => setExperimentDays(db, '2026-11-12', { [experiment.id]: true }, today)).toThrow('no answer');
      expect(getExperiment(db, experiment.id)!.end_date).toBe('2026-11-21');
      setExperimentDays(db, '2026-11-10', { [experiment.id]: null }, today);
      expect(listExperimentDays(db, experiment.id)).toEqual([]);
    });
  });

  it('clearJournal empties both tables', () => {
    const db = createTestDb();
    const experiment = createExperiment(db, { title: 'A', start_date: '2026-11-20', days: 28, check_in: true }, today);
    setExperimentDays(db, '2026-11-21', { [experiment.id]: true }, today);
    clearJournal(db);
    expect(listExperiments(db)).toEqual([]);
    expect(listExperimentDays(db)).toEqual([]);
  });
});
