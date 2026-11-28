import { readFileSync } from 'node:fs';
import path from 'node:path';

import { countRows } from '@/db/repositories/maintenance';
import { createTestDb } from '@/db/testDb';
import i18n from '@/lib/i18n';

import { buildExport } from '../serialize';
import { applyPendingImport, importErrorKey, readImportFile, UnknownFormatError } from '../pending';

const csv = readFileSync(path.join(__dirname, '..', '..', 'daylio', '__tests__', 'fixtures', 'sample.csv'), 'utf8');

describe('pending import', () => {
  it('reads CSV and JSON by content and applies either', () => {
    const file = readImportFile('export', csv);
    expect(file.kind).toBe('csv');
    const db = createTestDb();
    expect(applyPendingImport(db, file, { mode: 'merge' })).toBe(6);

    const json = readImportFile('backup.json', JSON.stringify(buildExport(db, '1.0.0')));
    expect(json.kind).toBe('json');
    const target = createTestDb();
    expect(applyPendingImport(target, json, { mode: 'replace' })).toBe(6);
    expect(countRows(target)).toEqual(countRows(db));
  });

  it('refuses other files', () => {
    expect(() => readImportFile('liste.csv', 'name,value\na,1')).toThrow(UnknownFormatError);
  });

  it('explains every unreadable file in one friendly style, never with the parser message', () => {
    const keyFor = (name: string, text: string) => {
      try {
        readImportFile(name, text);
      } catch (error) {
        return importErrorKey(error);
      }
      return null;
    };
    expect(keyFor('liste.csv', 'name,value')).toBe('settings.importError.notBackup');
    expect(keyFor('fremd.json', '{"app": "other"}')).toBe('settings.importError.notBackup');
    expect(keyFor('kaputt.json', '{"app": "daylight", "schema_version": 1')).toBe('settings.importError.damaged');
    expect(keyFor('neu.json', '{"app": "daylight", "schema_version": 99}')).toBe('settings.importError.newer');
    for (const code of ['notBackup', 'damaged', 'newer']) expect(i18n.t(`settings.importError.${code}`)).toMatch(/^Daylight kann diese Datei nicht einlesen\. /);
  });
});
