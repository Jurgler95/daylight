import { strToU8, zipSync } from 'fflate';

import { listEntryDetails } from '@/db/repositories/entries';
import { countRows } from '@/db/repositories/maintenance';
import { createTestDb } from '@/db/testDb';
import { daylioPhotoName, memoryPhotoStore } from '@/lib/photos/store';

import { applyDaylioImport } from '../apply';
import { DaylioBackupError, isZip, parseDaylioBackup } from '../backup';

const JPEG_A = new Uint8Array([0xff, 0xd8, 1, 2, 3]);
const JPEG_B = new Uint8Array([0xff, 0xd8, 4, 5, 6]);

/** A small `.daylio` in the layout of a real one: absolute names, Base64 JSON, photos by checksum. */
function daylioFile(overrides: Record<string, unknown> = {}): Uint8Array {
  const backup = {
    version: 15,
    customMoods: [
      { id: 1, custom_name: '', mood_group_id: 1 },
      { id: 2, custom_name: '', mood_group_id: 2 },
      { id: 6, custom_name: 'Müde', mood_group_id: 4 },
    ],
    tag_groups: [
      { id: 1, name: 'Gefühle', order: 1 },
      { id: 2, name: 'Wetter', order: 2 },
    ],
    tags: [
      { id: 10, name: 'Sonnig', order: 1, id_tag_group: 2 },
      { id: 11, name: 'Glücklich', order: 1, id_tag_group: 1 },
      { id: 12, name: 'Urlaub', order: 2, id_tag_group: 1 },
      { id: 13, name: 'Urlaub', order: 3, id_tag_group: 2 },
    ],
    assets: [
      { id: 1, checksum: 'aa11', type: 1 },
      { id: 2, checksum: 'bb22', type: 1 },
      { id: 3, checksum: 'cc33', type: 1 },
    ],
    dayEntries: [
      { id: 3, year: 2026, month: 8, day: 24, hour: 20, minute: 12, mood: 1, note: 'Kuchen<br>und Waffeln &amp; Tee', tags: [10, 11], assets: [1, 2] },
      { id: 2, year: 2026, month: 0, day: 5, hour: 7, minute: 5, mood: 6, note: '', tags: [12, 13], assets: [3] },
      { id: 1, year: 2025, month: 11, day: 29, hour: 21, minute: 0, mood: 2, tags: [], assets: [] },
      { id: 0, year: 2026, month: 12, day: 1, hour: 0, minute: 0, mood: 1 },
    ],
    ...overrides,
  };
  const encoded = Buffer.from(JSON.stringify(backup), 'utf8').toString('base64');
  return zipSync({
    'backup.daylio': strToU8(encoded),
    '/assets/photos/2026/8/aa11': JPEG_A,
    '/assets/photos/2026/8/bb22': JPEG_B,
  });
}

describe('Daylio backup', () => {
  it('reads entries like the CSV: 1-based months, decoded notes, moods by level, tags in Daylio order', () => {
    const bytes = daylioFile();
    expect(isZip(bytes)).toBe(true);
    const parsed = parseDaylioBackup(bytes);
    expect(parsed.errors).toEqual([{ line: 4, code: 'entry', value: '' }]);
    expect(parsed.entries.map((e) => [e.date, e.time, e.mood, e.activities, e.note, e.photos])).toEqual([
      ['2026-09-24', '20:12', 'Super', ['Glücklich', 'Sonnig'], 'Kuchen\nund Waffeln & Tee', [daylioPhotoName('aa11'), daylioPhotoName('bb22')]],
      ['2026-01-05', '07:05', 'Müde', ['Urlaub'], null, []],
      ['2025-12-29', '21:00', 'Gut', [], null, []],
    ]);
    expect(parsed.warnings.map((w) => `${w.line}:${w.code}`)).toEqual(['2:duplicateActivity', '2:photoMissing']);
    expect([...(parsed.photoFiles?.keys() ?? [])]).toEqual(['daylio-aa11.jpg', 'daylio-bb22.jpg']);
  });

  it('rejects a ZIP that is not a Daylio backup', () => {
    expect(() => parseDaylioBackup(zipSync({ 'other.txt': strToU8('x') }))).toThrow(DaylioBackupError);
    expect(() => parseDaylioBackup(new Uint8Array([1, 2, 3]))).toThrow(DaylioBackupError);
  });

  it('imports entries with their photos and brings nothing twice', () => {
    const db = createTestDb();
    const store = memoryPhotoStore();
    const parsed = parseDaylioBackup(daylioFile());
    const outcome = applyDaylioImport(db, parsed, { mode: 'merge', skipErrors: true, store, choices: { moodLevels: { müde: 2 } } });
    expect(outcome).toEqual({ added: 3, duplicates: 0, skipped: 1, photos: 2 });
    const withPhoto = listEntryDetails(db).find((entry) => entry.photos.length > 0);
    expect(withPhoto?.photos).toEqual(['daylio-aa11.jpg', 'daylio-bb22.jpg']);
    expect(store.files.get('daylio-aa11.jpg')).toEqual(JPEG_A);

    expect(applyDaylioImport(db, parsed, { mode: 'merge', skipErrors: true, store })).toMatchObject({ added: 0, photos: 0 });
    expect(countRows(db)).toMatchObject({ entries: 3, photos: 2 });
  });

  it('adds the photos to entries that came in earlier without them', () => {
    const db = createTestDb();
    const parsed = parseDaylioBackup(daylioFile());
    applyDaylioImport(db, parsed, { mode: 'merge', skipErrors: true });
    expect(countRows(db)).toMatchObject({ entries: 3, photos: 0 });

    const store = memoryPhotoStore();
    expect(applyDaylioImport(db, parsed, { mode: 'merge', skipErrors: true, store })).toMatchObject({ added: 0, duplicates: 3, photos: 2 });
    expect(store.files.size).toBe(2);
  });

  it('replace removes the files of the photos it replaces', () => {
    const db = createTestDb();
    const store = memoryPhotoStore();
    applyDaylioImport(db, parseDaylioBackup(daylioFile()), { mode: 'merge', skipErrors: true, store });
    const withoutPhotos = parseDaylioBackup(daylioFile({ assets: [] }));
    applyDaylioImport(db, withoutPhotos, { mode: 'replace', skipErrors: true, store });
    expect(countRows(db)).toMatchObject({ entries: 3, photos: 0 });
    expect(store.files.size).toBe(0);
  });
});
