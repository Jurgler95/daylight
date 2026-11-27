import { createEntry, createExperiment, endExperiment, listExperimentDays, listExperiments, listMoods, setExperimentDays } from '@/db/repositories';
import { deleteAllData } from '@/db/repositories/maintenance';
import { createTestDb } from '@/db/testDb';
import type { DateString } from '@/lib/dates';
import type { ImportPlan } from '@/lib/daylio/plan';

import { applyImport, buildExport, parseImport, previewImport } from '../index';
import { mergeImport } from '../merge';
import { experimentsLost, summarizePlan } from '../summary';

const today = '2026-11-27' as DateString;

function journal() {
  const db = createTestDb();
  createEntry(db, { date: '2026-11-01', time: '20:00', mood_id: listMoods(db)[0]!.id, activity_ids: [] });
  const over = createExperiment(db, { title: 'Kein Kaffee', note: 'nach 14 Uhr', start_date: '2026-10-01', days: 28, check_in: true }, today);
  const running = createExperiment(db, { title: 'Abendspaziergang', start_date: '2026-11-20', days: 14, check_in: true }, today);
  setExperimentDays(db, '2026-10-02', { [over.id]: true }, '2026-10-02' as DateString);
  setExperimentDays(db, '2026-11-21', { [running.id]: true }, today);
  setExperimentDays(db, '2026-11-22', { [running.id]: true }, today);
  return db;
}

describe('experiments in the JSON backup', () => {
  it('replace restores them exactly, answers and result_seen included', () => {
    const db = journal();
    const before = buildExport(db, '1', 'X');
    expect(before.experiments).toHaveLength(2);
    expect(before.experiment_days).toHaveLength(3);
    deleteAllData(db);
    expect(listExperiments(db)).toEqual([]);
    applyImport(db, parseImport(JSON.stringify(before)), 'replace');
    expect(buildExport(db, '1', 'X')).toEqual(before);
    expect(listExperiments(db).map((row) => row.result_seen)).toEqual([true, false]);
  });

  it('merge keeps an experiment that is already here, adds its missing answers and nothing twice', () => {
    const source = journal();
    const payload = parseImport(JSON.stringify(buildExport(source, '1')));
    const target = createTestDb();
    const here = createExperiment(target, { title: 'abendspaziergang', start_date: '2026-11-20', days: 14, check_in: true }, today);
    setExperimentDays(target, '2026-11-21', { [here.id]: false }, today);

    applyImport(target, payload, 'merge');
    const rows = listExperiments(target);
    expect(rows.map((row) => [row.title, row.result_seen])).toEqual([
      ['Kein Kaffee', true],
      // Stays as it was here, its "no" too.
      ['abendspaziergang', false],
    ]);
    // The "no" on the 21st ended it here on the 20th, so the backup's answer for the 22nd stays out.
    const days = listExperimentDays(target).map((row) => [row.experiment_id, row.date, row.kept]);
    const coffee = rows[0]!.id;
    expect(days).toEqual(
      expect.arrayContaining([
        [coffee, '2026-10-02', true],
        [here.id, '2026-11-21', false],
      ]),
    );
    expect(days).toHaveLength(2);

    applyImport(target, payload, 'merge');
    expect(listExperiments(target)).toHaveLength(2);
    expect(listExperimentDays(target)).toHaveLength(2);
  });

  it('new experiments from a merge that are over count as seen; running ones keep their card', () => {
    const payload = parseImport(JSON.stringify(buildExport(journal(), '1')));
    const target = createTestDb();
    target.transaction((tx) => mergeImport(tx, payload, today));
    expect(listExperiments(target).map((row) => [row.title, row.result_seen])).toEqual([
      ['Kein Kaffee', true],
      ['Abendspaziergang', false],
    ]);
  });

  it('merge adds no answers outside the span of an experiment that is already here', () => {
    const source = journal();
    const payload = parseImport(JSON.stringify(buildExport(source, '1')));
    const target = createTestDb();
    // Here it was ended early on 21 November; the backup still has an answer for the 22nd.
    const here = createExperiment(target, { title: 'Abendspaziergang', start_date: '2026-11-20', days: 14, check_in: true }, '2026-11-20' as DateString);
    endExperiment(target, here.id, '2026-11-22' as DateString);
    target.transaction((tx) => mergeImport(tx, payload, today));
    expect(listExperimentDays(target, here.id).map((row) => row.date)).toEqual(['2026-11-21']);
  });

  it('merge brings no "no" into an experiment that is already here and still runs', () => {
    const source = createTestDb();
    const there = createExperiment(source, { title: 'Abendspaziergang', start_date: '2026-11-20', days: 14, check_in: true }, '2026-11-20' as DateString);
    setExperimentDays(source, '2026-11-21', { [there.id]: true }, '2026-11-21' as DateString);
    setExperimentDays(source, '2026-11-24', { [there.id]: false }, '2026-11-24' as DateString);
    const payload = parseImport(JSON.stringify(buildExport(source, '1')));
    const target = createTestDb();
    const here = createExperiment(target, { title: 'Abendspaziergang', start_date: '2026-11-20', days: 14, check_in: true }, '2026-11-20' as DateString);
    target.transaction((tx) => mergeImport(tx, payload, today));
    expect(listExperimentDays(target, here.id).map((row) => [row.date, row.kept])).toEqual([['2026-11-21', true]]);
    expect(listExperiments(target)[0]!.end_date).toBe('2026-12-03');
  });

  it('reads an older backup without the fields, and a replace with it removes the stored ones', () => {
    const db = journal();
    const { experiments: _e, experiment_days: _d, ...older } = buildExport(db, '1');
    const payload = parseImport(JSON.stringify(older));
    expect(payload.experiments).toBeUndefined();
    expect(previewImport(db, payload)).toMatchObject({ experiments: 0, experimentsLost: 2 });
    applyImport(db, payload, 'merge');
    expect(listExperiments(db)).toHaveLength(2);
    applyImport(db, payload, 'replace');
    expect(listExperiments(db)).toEqual([]);
    expect(listExperimentDays(db)).toEqual([]);
  });

  it('the preview counts the experiments in the file and those a replace would lose', () => {
    const source = journal();
    const payload = parseImport(JSON.stringify(buildExport(source, '1')));
    expect(previewImport(createTestDb(), payload)).toMatchObject({ experiments: 2, experimentsLost: 0 });
    expect(previewImport(source, payload)).toMatchObject({ experiments: 2, experimentsLost: 0 });
    const target = createTestDb();
    createExperiment(target, { title: 'Etwas anderes', start_date: '2026-11-01', days: 7 }, today);
    createExperiment(target, { title: 'Kein Kaffee', start_date: '2026-10-01', days: 7 }, today);
    expect(previewImport(target, payload)).toMatchObject({ experiments: 2, experimentsLost: 1 });
  });

  it('refuses broken references, double answers and impossible spans', () => {
    const payload = buildExport(journal(), '1');
    const broken = (patch: object) => () => parseImport(JSON.stringify({ ...payload, ...patch }));
    expect(broken({ experiment_days: [{ experiment_id: 99, date: '2026-11-21', kept: true }] })).toThrow('experiment_days');
    const answer = payload.experiment_days![0]!;
    expect(broken({ experiment_days: [answer, answer] })).toThrow('doppelte Antworten');
    const first = payload.experiments![0]!;
    expect(broken({ experiments: [{ ...first, end_date: '2026-09-30' }] })).toThrow('Zeitraum');
    expect(broken({ experiments: [{ ...first, end_date: '2027-01-01' }] })).toThrow('Zeitraum');
    expect(broken({ experiments: [first, first], experiment_days: [] })).toThrow('doppelte Experiment-ids');
    expect(broken({ experiments: [{ ...first, title: 'x'.repeat(61) }], experiment_days: [] })).toThrow();
    expect(broken({ experiments: [{ ...first, title: ` ${'x'.repeat(60)} ` }], experiment_days: [] })).not.toThrow();
    // One day is fine, even though the app itself asks for seven.
    expect(broken({ experiments: [{ ...first, end_date: first.start_date }], experiment_days: [] })).not.toThrow();
  });
});

describe('experiments in the import preview', () => {
  it('counts stored experiments the file does not bring again', () => {
    const stored = [
      { title: 'Kein Kaffee', start_date: '2026-10-01' },
      { title: 'Spaziergang', start_date: '2026-11-01' },
    ];
    expect(experimentsLost(stored, [{ title: 'kein kaffee ', start_date: '2026-10-01' }])).toBe(1);
    expect(experimentsLost(stored, [])).toBe(2);
    expect(experimentsLost([], stored)).toBe(0);
  });

  it('a CSV holds no experiments, so a replace loses every stored one', () => {
    const plan = { entryCount: 0, from: null, to: null, moods: [], activities: [], entries: [], duplicates: 0, photos: 0, newPhotos: 0 } as unknown as ImportPlan;
    expect(summarizePlan(plan, [{ title: 'A', start_date: '2026-10-01' }])).toMatchObject({ experiments: 0, experimentsLost: 1 });
    expect(summarizePlan(plan)).toMatchObject({ experiments: 0, experimentsLost: 0 });
  });
});
