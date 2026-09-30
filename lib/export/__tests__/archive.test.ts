import { strToU8, zipSync } from 'fflate';

import { createEntry, listEntryDetails, listMoods, setPhotos } from '@/db/repositories';
import { countRows } from '@/db/repositories/maintenance';
import { createTestDb } from '@/db/testDb';
import { memoryPhotoStore } from '@/lib/photos/store';

import { ARCHIVE_JSON, writeBackupArchive } from '../archive';
import { applyPendingImport, readImportBytes } from '../pending';
import { buildExport } from '../serialize';

const PHOTO = new Uint8Array([0xff, 0xd8, 9, 9]);

function journal() {
  const db = createTestDb();
  const store = memoryPhotoStore({ 'photo-a.jpg': PHOTO, 'photo-b.jpg': new Uint8Array([1]) });
  const mood = listMoods(db)[0]!.id;
  const first = createEntry(db, { date: '2026-09-01', time: '20:00', mood_id: mood, note: 'Eins' });
  createEntry(db, { date: '2026-09-02', time: '20:00', mood_id: mood, note: 'Zwei' });
  setPhotos(db, first.id, ['photo-a.jpg', 'photo-b.jpg']);
  return { db, store };
}

function archive(db: ReturnType<typeof createTestDb>, store: ReturnType<typeof memoryPhotoStore>): Uint8Array {
  const chunks: Uint8Array[] = [];
  writeBackupArchive(buildExport(db, '1.0.0', 'X'), store, (chunk) => chunks.push(chunk));
  return Buffer.concat(chunks);
}

describe('backup archive', () => {
  it('restores entries, photo rows and files on replace', () => {
    const { db, store } = journal();
    const file = readImportBytes('daylight-export.zip', archive(db, store));
    expect(file.kind).toBe('json');

    const target = createTestDb();
    const targetStore = memoryPhotoStore({ 'left-over.jpg': new Uint8Array([7]) });
    expect(applyPendingImport(target, file, { mode: 'replace', store: targetStore })).toBe(2);
    expect(buildExport(target, '1.0.0', 'X')).toEqual(buildExport(db, '1.0.0', 'X'));
    expect([...targetStore.files.keys()].sort()).toEqual(['photo-a.jpg', 'photo-b.jpg']);
    expect(targetStore.files.get('photo-a.jpg')).toEqual(PHOTO);
  });

  it('merge brings the photos to entries that are already there', () => {
    const { db, store } = journal();
    const bytes = archive(db, store);
    const target = createTestDb();
    const mood = listMoods(target)[0]!.id;
    createEntry(target, { date: '2026-09-01', time: '20:00', mood_id: mood, note: 'Eins' });
    const targetStore = memoryPhotoStore();
    expect(applyPendingImport(target, readImportBytes('x', bytes), { mode: 'merge', store: targetStore })).toBe(1);
    expect(listEntryDetails(target).map((entry) => entry.photos)).toEqual([['photo-a.jpg', 'photo-b.jpg'], []]);
    // A second merge changes nothing.
    applyPendingImport(target, readImportBytes('x', bytes), { mode: 'merge', store: targetStore });
    expect(countRows(target)).toMatchObject({ entries: 2, photos: 2 });
  });

  it('drops photo rows whose file is missing, and reads a plain JSON backup of version 1', () => {
    const { db } = journal();
    const payload = buildExport(db, '1.0.0', 'X');
    const bare = zipSync({ [ARCHIVE_JSON]: strToU8(JSON.stringify(payload)) });
    const target = createTestDb();
    applyPendingImport(target, readImportBytes('x', bare), { mode: 'replace', store: memoryPhotoStore() });
    expect(countRows(target)).toMatchObject({ entries: 2, photos: 0 });

    const { entry_photos: _photos, ...v1 } = { ...payload, schema_version: 1 };
    const old = readImportBytes('alt.json', strToU8(JSON.stringify(v1)));
    expect(old.kind === 'json' && old.payload.entry_photos).toEqual([]);
  });

  it('refuses a name that could leave the photo folder', () => {
    const { db } = journal();
    const payload = buildExport(db, '1.0.0', 'X');
    const evil = { ...payload, entry_photos: [{ ...payload.entry_photos[0]!, file_name: '../daylight.db' }] };
    const bytes = zipSync({ [ARCHIVE_JSON]: strToU8(JSON.stringify(evil)), 'photos/../daylight.db': PHOTO });
    expect(() => readImportBytes('x', bytes)).toThrow('Fotoname');
  });
});
