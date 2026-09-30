import { createActivity, createEntry, createMood, getSettings, listGroups, updateSettings } from '@/db/repositories';
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
    const [feelings] = listGroups(target);
    const tired = createActivity(target, { group_id: feelings!.id, name: 'müde' });
    const first = payload.entries[0]!;
    const level = payload.moods.find((m) => m.id === first.mood_id)!.level;
    createEntry(target, { date: first.date, time: first.time, mood_id: 6 - level, note: first.note, activity_ids: [tired.id] });

    const preview = previewImport(target, payload);
    expect(preview).toMatchObject({ entries: payload.entries.length, toAdd: payload.entries.length - 1, duplicates: 1, newMoods: 1 });
    expect(preview.newActivities).toBe(payload.activities.length - 1);

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
