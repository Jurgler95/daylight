import {
  createActivity,
  createEntry,
  createMood,
  createScale,
  getSettings,
  listGroups,
  listHealthDays,
  listMoods,
  listScales,
  replaceHealthDays,
  updateSettings,
} from '@/db/repositories';
import { countRows, deleteAllData } from '@/db/repositories/maintenance';
import { createTestDb } from '@/db/testDb';
import type { DateString } from '@/lib/dates';
import { generateSample } from '@/lib/dev/generateSample';
import { applySample } from '@/lib/dev/sample';

import { applyImport, buildExport, detectFormat, parseImport, previewImport } from '../index';

const today = '2026-09-26' as DateString;

function sampled() {
  const db = createTestDb();
  applySample(db, generateSample({ today, days: 120 }));
  createMood(db, { label: 'Erschöpft', level: 2 });
  updateSettings(db, { reminder_enabled: true, reminder_time: '21:15', outlook_enabled: false, last_export_at: '2026-09-01T10:00:00.000Z' });
  return db;
}

describe('JSON round trip', () => {
  it('replace restores an identical database', () => {
    const db = sampled();
    const before = buildExport(db, '1.0.0', 'X');
    expect(before.entries.length).toBeGreaterThan(100);
    expect(before.planned_activities.length).toBeGreaterThan(0);
    expect(before.entry_scales.length).toBeGreaterThan(0);

    deleteAllData(db);
    expect(countRows(db).entries).toBe(0);
    applyImport(db, parseImport(JSON.stringify(before)), 'replace');
    expect(buildExport(db, '1.0.0', 'X')).toEqual(before);
    expect(getSettings(db)).toMatchObject({ reminder_time: '21:15', outlook_enabled: false });
  });

  it('keeps the device-local backup time out of the file and in place on replace', () => {
    const db = sampled();
    const payload = buildExport(db, '1.0.0');
    expect('last_export_at' in payload.settings).toBe(false);
    applyImport(db, payload, 'replace');
    expect(getSettings(db).last_export_at).toBe('2026-09-01T10:00:00.000Z');
  });

  it('keeps the reminder sheet, the streak state, the rating card and light or dark on the device', () => {
    const db = sampled();
    const local = {
      reminder_prompt_done: true,
      streak_celebrated: '{"start":"2026-09-01","days":20}',
      streak_rescue_dismissed: '2026-09-20',
      review_prompt_done: true,
      color_scheme: 'dark' as const,
      auto_backup_dir: 'content://com.android.externalstorage.documents/tree/primary%3ADaylight',
      auto_backup_at: '2026-09-20T08:00:00.000Z',
      auto_backup_tried_at: '2026-09-20T08:00:00.000Z',
      auto_backup_error: 'gone',
      auto_backup_hash: 'abc',
      backup_hint_dismissed_on: '2026-09-20',
    };
    updateSettings(db, local);
    const payload = buildExport(db, '1.0.0');
    for (const key of Object.keys(local)) expect(key in payload.settings).toBe(false);
    const target = createTestDb();
    applyImport(target, parseImport(JSON.stringify(payload)), 'replace');
    expect(getSettings(target)).toMatchObject({ reminder_prompt_done: false, streak_celebrated: null, streak_rescue_dismissed: null, review_prompt_done: false, color_scheme: null, auto_backup_dir: null, auto_backup_at: null, backup_hint_dismissed_on: null });
  });

  it('carries the morning outlook notification, and a backup from before it leaves the choice here alone', () => {
    const source = sampled();
    updateSettings(source, { outlook_notify_enabled: true, outlook_notify_time: '07:15' });
    const payload = buildExport(source, '1.0.0');
    expect(payload.settings).toMatchObject({ outlook_notify_enabled: true, outlook_notify_time: '07:15' });
    const target = createTestDb();
    applyImport(target, parseImport(JSON.stringify(payload)), 'replace');
    expect(getSettings(target)).toMatchObject({ outlook_notify_enabled: true, outlook_notify_time: '07:15' });

    const { outlook_notify_enabled: _e, outlook_notify_time: _t, ...older } = payload.settings;
    updateSettings(target, { outlook_notify_enabled: false, outlook_notify_time: '06:45' });
    applyImport(target, parseImport(JSON.stringify({ ...payload, settings: older })), 'replace');
    expect(getSettings(target)).toMatchObject({ outlook_notify_enabled: false, outlook_notify_time: '06:45' });
  });

  it('carries the morning reminder, and a backup from before it leaves the choice here alone', () => {
    const source = sampled();
    updateSettings(source, { reminder_yesterday_enabled: false, reminder_yesterday_time: '09:15', reminder_always: true });
    const payload = buildExport(source, '1.0.0');
    expect(payload.settings).toMatchObject({ reminder_yesterday_enabled: false, reminder_yesterday_time: '09:15', reminder_always: true });

    const target = createTestDb();
    applyImport(target, parseImport(JSON.stringify(payload)), 'replace');
    expect(getSettings(target)).toMatchObject({ reminder_yesterday_enabled: false, reminder_yesterday_time: '09:15', reminder_always: true });

    const { reminder_yesterday_enabled: _e, reminder_yesterday_time: _t, reminder_always: _a, ...older } = payload.settings;
    const old = parseImport(JSON.stringify({ ...payload, settings: older }));
    updateSettings(target, { reminder_yesterday_enabled: true, reminder_yesterday_time: '11:00' });
    applyImport(target, old, 'replace');
    expect(getSettings(target)).toMatchObject({ reminder_yesterday_enabled: true, reminder_yesterday_time: '11:00', reminder_always: true, reminder_time: '21:15' });
    applyImport(createTestDb(), old, 'merge');
  });

  it('carries several reminder times, with `reminder_time` as the latest for older app versions', () => {
    const source = sampled();
    updateSettings(source, { reminder_times: ['21:00', '08:30', '13:00'] });
    const payload = buildExport(source, '1.0.0');
    expect(payload.settings).toMatchObject({ reminder_times: ['08:30', '13:00', '21:00'], reminder_time: '21:00' });

    const target = createTestDb();
    applyImport(target, parseImport(JSON.stringify(payload)), 'replace');
    expect(getSettings(target)).toMatchObject({ reminder_times: ['08:30', '13:00', '21:00'], reminder_time: '21:00' });
    expect(buildExport(target, '1.0.0', payload.exported_at).settings).toEqual(payload.settings);
  });

  it('builds the list from the one time of a backup from before several reminder times', () => {
    const source = sampled();
    const payload = buildExport(source, '1.0.0');
    const { reminder_times: _times, ...older } = payload.settings;
    expect(older.reminder_time).toBe('21:15');

    const target = createTestDb();
    updateSettings(target, { reminder_times: ['07:00', '12:00', '19:00'] });
    applyImport(target, parseImport(JSON.stringify({ ...payload, settings: older })), 'replace');
    expect(getSettings(target)).toMatchObject({ reminder_time: '21:15', reminder_times: ['21:15'] });
  });

  it('tidies a broken list of reminder times instead of refusing the backup', () => {
    const payload = buildExport(sampled(), '1.0.0');
    const read = (reminder_times: unknown) => parseImport(JSON.stringify({ ...payload, settings: { ...payload.settings, reminder_times } })).settings;
    // Invalid and repeated times go, the rest is sorted, and the single time follows the list.
    expect(read(['22:00', 'abc', '07:15', '07:15', 5, null, '24:00'])).toMatchObject({ reminder_times: ['07:15', '22:00'], reminder_time: '22:00' });
    // Too many: five stay.
    expect(read(['01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00']).reminder_times).toEqual(['01:00', '02:00', '03:00', '04:00', '05:00']);
    // Nothing usable: the single time of the backup is the list.
    for (const broken of [[], ['x'], 'text', 42, null, { a: 1 }]) expect(read(broken)).toMatchObject({ reminder_times: ['21:15'], reminder_time: '21:15' });

    const target = createTestDb();
    applyImport(target, parseImport(JSON.stringify({ ...payload, settings: { ...payload.settings, reminder_times: ['22:00', 'abc', '07:15'] } })), 'replace');
    expect(getSettings(target)).toMatchObject({ reminder_times: ['07:15', '22:00'], reminder_time: '22:00' });
  });

  it('leaves the reminder times of this device alone on a merge', () => {
    const payload = buildExport(sampled(), '1.0.0');
    const target = createTestDb();
    updateSettings(target, { reminder_times: ['07:00', '19:00'] });
    applyImport(target, parseImport(JSON.stringify(payload)), 'merge');
    expect(getSettings(target)).toMatchObject({ reminder_times: ['07:00', '19:00'], reminder_time: '19:00' });
  });

  it('carries the seasonal designs, and a backup from before them leaves the choice here alone', () => {
    const source = sampled();
    updateSettings(source, { design_seasons: true, design_festivals: false });
    const payload = buildExport(source, '1.0.0');
    expect(payload.settings).toMatchObject({ design_seasons: true, design_festivals: false });

    const target = createTestDb();
    expect(getSettings(target)).toMatchObject({ design_seasons: true, design_festivals: true });
    applyImport(target, parseImport(JSON.stringify(payload)), 'replace');
    expect(getSettings(target)).toMatchObject({ design_seasons: true, design_festivals: false });

    const { design_seasons: _s, design_festivals: _f, ...older } = payload.settings;
    updateSettings(target, { design_seasons: false });
    applyImport(target, parseImport(JSON.stringify({ ...payload, settings: older })), 'replace');
    expect(getSettings(target)).toMatchObject({ design_seasons: false, design_festivals: false });
  });
});

describe('duration scales in the backup', () => {
  it('keep their kind and minutes', () => {
    const db = sampled();
    const work = createScale(db, { name: 'Arbeit', kind: 'duration' });
    const mood = listMoods(db)[0];
    createEntry(db, { date: '2026-09-27', time: '20:00', mood_id: mood?.id ?? 0, scales: [{ scale_id: work.id, value: 510 }] });
    const target = createTestDb();
    applyImport(target, parseImport(JSON.stringify(buildExport(db, '1.0.0'))), 'replace');
    expect(listScales(target).find((scale) => scale.name === 'Arbeit')).toMatchObject({ kind: 'duration', min: 0, max: 1440 });
    expect(buildExport(target, '1.0.0').entry_scales).toContainEqual(expect.objectContaining({ scale_id: work.id, value: 510 }));
  });

  it('a file from before them reads every scale as a rating', () => {
    const file = buildExport(sampled(), '1.0.0');
    const old = { ...file, scales: file.scales.map(({ kind: _kind, ...scale }) => scale) };
    expect(parseImport(JSON.stringify(old)).scales.every((scale) => scale.kind === 'rating')).toBe(true);
  });
});

describe('number scales in the backup', () => {
  it('keep unit, decimals and decimal values', () => {
    const db = sampled();
    const weight = createScale(db, { name: 'Gewicht', kind: 'number', unit: 'kg', decimals: 1 });
    const mood = listMoods(db)[0];
    createEntry(db, { date: '2026-09-27', time: '07:00', mood_id: mood?.id ?? 0, scales: [{ scale_id: weight.id, value: 72.4 }] });
    const target = createTestDb();
    applyImport(target, parseImport(JSON.stringify(buildExport(db, '1.0.0'))), 'replace');
    expect(listScales(target).find((scale) => scale.name === 'Gewicht')).toMatchObject({ kind: 'number', unit: 'kg', decimals: 1 });
    expect(buildExport(target, '1.0.0').entry_scales).toContainEqual(expect.objectContaining({ scale_id: weight.id, value: 72.4 }));
  });

  it('a file from before them has no unit and no decimals', () => {
    const file = buildExport(sampled(), '1.0.0');
    const old = { ...file, scales: file.scales.map(({ unit: _unit, decimals: _decimals, ...scale }) => scale) };
    expect(parseImport(JSON.stringify(old)).scales.every((scale) => scale.unit === '' && scale.decimals === 0)).toBe(true);
  });

  it('a decimal on a rating is refused', () => {
    const db = sampled();
    const energy = listScales(db)[0]!;
    const mood = listMoods(db)[0];
    createEntry(db, { date: '2026-09-27', time: '07:00', mood_id: mood?.id ?? 0, scales: [{ scale_id: energy.id, value: 3 }] });
    const file = buildExport(db, '1.0.0');
    const broken = { ...file, entry_scales: file.entry_scales.map((row) => (row.scale_id === energy.id ? { ...row, value: 3.5 } : row)) };
    expect(() => parseImport(JSON.stringify(broken))).toThrow();
  });
});

describe('health days in the backup', () => {
  const steps = (date: string, value: number) => ({ date, steps: value, sleep_minutes: 420, resting_hr: null, exercise_minutes: null });

  it('stay out unless the user opted in', () => {
    const db = sampled();
    replaceHealthDays(db, '2026-09-01', '2026-09-02', [steps('2026-09-01', 5000), steps('2026-09-02', 7000)]);
    expect(buildExport(db, '1.0.0').health_days).toBeUndefined();
    updateSettings(db, { health_in_backup: true });
    expect(buildExport(db, '1.0.0').health_days?.map((day) => [day.date, day.steps])).toEqual([
      ['2026-09-01', 5000],
      ['2026-09-02', 7000],
    ]);
  });

  it('come back on a new device, marked as restored, and keep the opt-in on', () => {
    const source = sampled();
    replaceHealthDays(source, '2026-09-01', '2026-09-02', [steps('2026-09-01', 5000), steps('2026-09-02', 7000)]);
    updateSettings(source, { health_in_backup: true });
    const payload = parseImport(JSON.stringify(buildExport(source, '1.0.0')));

    const target = createTestDb();
    expect(previewImport(target, payload).healthDays).toBe(2);
    applyImport(target, payload, 'replace');
    expect(listHealthDays(target).map((day) => [day.date, day.steps, day.restored])).toEqual([
      ['2026-09-01', 5000, true],
      ['2026-09-02', 7000, true],
    ]);
    expect(getSettings(target).health_in_backup).toBe(true);
  });

  it('a file from before the opt-in still imports', () => {
    const payload = parseImport(JSON.stringify(buildExport(sampled(), '1.0.0')));
    const target = createTestDb();
    applyImport(target, payload, 'merge');
    expect(listHealthDays(target)).toEqual([]);
    expect(getSettings(target).health_in_backup).toBe(false);
  });
});

describe('JSON validation', () => {
  it('rejects bad files before touching the database', () => {
    const db = sampled();
    const rows = countRows(db);
    const good = buildExport(db, '1', 'X');
    expect(() => parseImport('[]')).toThrow('Export-Objekt');
    expect(() => parseImport('{"schema_version": 1}')).toThrow('Daylight');
    expect(() => parseImport('{"app": "daylight", "schema_version": 99}')).toThrow('neuer');
    expect(() => parseImport('{"app": "daylight", "schema_version": 1, "entries": "nope"}')).toThrow();
    expect(() => parseImport(JSON.stringify({ ...good, entries: [{ ...good.entries[0], time: '8:00' }] }))).toThrow();
    expect(() => parseImport(JSON.stringify({ ...good, entries: [{ ...good.entries[0], mood_id: 999 }] }))).toThrow('Stimmung fehlt');
    expect(() => parseImport(JSON.stringify({ ...good, entry_activities: [{ entry_id: 1, activity_id: 9999 }] }))).toThrow('entry_activities');
    expect(countRows(db)).toEqual(rows);
  });

  it('rolls back the whole import when a row fails', () => {
    const db = sampled();
    const payload = buildExport(db, '1', 'X');
    const broken = { ...payload, entries: [...payload.entries, { ...payload.entries[0]! }] };
    const rows = countRows(db);
    expect(() => applyImport(db, broken, 'replace')).toThrow();
    expect(countRows(db)).toEqual(rows);
  });
});

describe('JSON merge', () => {
  it('adds only what is missing and never duplicates entries', () => {
    const payload = buildExport(sampled(), '1', 'X');
    const target = createTestDb();
    // The first entry is already here, with the same activities in the same groups.
    const first = payload.entries[0]!;
    const groupIds = new Map(listGroups(target).map((group) => [group.name, group.id]));
    const activityIds = payload.entry_activities
      .filter((link) => link.entry_id === first.id)
      .map((link) => {
        const activity = payload.activities.find((a) => a.id === link.activity_id)!;
        const group = payload.activity_groups.find((g) => g.id === activity.group_id)!;
        return createActivity(target, { group_id: groupIds.get(group.name)!, name: activity.name }).id;
      });
    expect(activityIds.length).toBeGreaterThan(0);
    const level = payload.moods.find((m) => m.id === first.mood_id)!.level;
    createEntry(target, { date: first.date, time: first.time, mood_id: 6 - level, note_title: first.note_title, note: first.note, activity_ids: activityIds });

    const preview = previewImport(target, payload);
    expect(preview).toMatchObject({ entries: payload.entries.length, toAdd: payload.entries.length - 1, duplicates: 1, newMoods: 1 });
    expect(preview.newActivities).toBe(payload.activities.length - activityIds.length);

    expect(applyImport(target, payload, 'merge')).toEqual({ added: payload.entries.length - 1, duplicates: 1 });
    const counts = countRows(target);
    expect(counts.entries).toBe(payload.entries.length);
    expect(counts.moods).toBe(6);
    expect(counts.activities).toBe(payload.activities.length);
    expect(counts.planned).toBe(payload.planned_activities.length);
    expect(getSettings(target).reminder_enabled).toBe(false);

    expect(applyImport(target, payload, 'merge')).toEqual({ added: 0, duplicates: payload.entries.length });
    expect(countRows(target)).toEqual(counts);
  });
});

describe('detectFormat', () => {
  it('tells JSON from Daylio CSV by content', () => {
    expect(detectFormat('  {"app":"daylight"}')).toBe('json');
    expect(detectFormat('﻿full_date,date,weekday,time,mood,activities,scales,note_title,note\n')).toBe('daylio-csv');
    expect(detectFormat('"full_date","mood","activities"')).toBe('daylio-csv');
    expect(detectFormat('date,flow\n')).toBe('unknown');
    expect(detectFormat('')).toBe('unknown');
  });
});
