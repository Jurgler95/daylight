import { readFileSync } from 'node:fs';
import path from 'node:path';

import { countRows } from '@/db/repositories/maintenance';
import { createTestDb } from '@/db/testDb';

import { buildExport } from '../serialize';
import { applyPendingImport, readImportFile, UnknownFormatError } from '../pending';

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
});
