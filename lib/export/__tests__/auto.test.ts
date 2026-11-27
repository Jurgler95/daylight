import { unzipSync } from 'fflate';

import { createEntry } from '@/db/repositories/entries';
import { setPhotos } from '@/db/repositories/photos';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import { createTestDb } from '@/db/testDb';
import { memoryPhotoStore } from '@/lib/photos/store';

import {
  AUTO_BACKUP_KEEP,
  AUTO_BACKUP_RETRY_MS,
  autoBackupDue,
  autoBackupFileName,
  classifyAutoBackupError,
  folderLabel,
  FOLDER_MISSING,
  isAutoBackupName,
  pruneAutoBackups,
  runAutoBackup,
  type BackupFolder,
} from '../auto';
import { readImportBytes } from '../pending';

const DIR = 'content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FDaylight';

function memoryFolder(initial: Record<string, Uint8Array> = {}) {
  const files = new Map(Object.entries(initial));
  const folder: BackupFolder & { files: Map<string, Uint8Array>; gone: boolean; full: boolean } = {
    files,
    gone: false,
    full: false,
    exists: () => !folder.gone,
    list: () => {
      if (folder.gone) throw new Error('does not exist');
      return [...files.keys()];
    },
    write: (name, _mime, bytes) => {
      // Like a full disk: the file is created, then the write breaks off.
      files.set(name, bytes.slice(0, 10));
      if (folder.full) throw new Error('ENOSPC (No space left on device)');
      files.set(name, bytes);
    },
    remove: (name) => void files.delete(name),
  };
  return folder;
}

function setup() {
  const db = createTestDb();
  createEntry(db, { date: '2026-09-01', time: '20:30', mood_id: 2, note: 'Ein guter Tag' });
  updateSettings(db, { auto_backup_dir: DIR });
  return db;
}

const at = (iso: string) => new Date(iso);

describe('autoBackupFileName', () => {
  it('names by local date and time and is recognised as our own', () => {
    const name = autoBackupFileName(new Date(2026, 8, 5, 7, 3), true);
    expect(name).toBe('daylight-auto-2026-09-05-0703.zip');
    expect(isAutoBackupName(name)).toBe(true);
    expect(isAutoBackupName(autoBackupFileName(new Date(2026, 8, 5, 21, 30), false))).toBe(true);
  });

  it('never takes other files for its own', () => {
    for (const name of ['daylight-export-2026-09-05.zip', 'daylight-auto-2026-09-05-0703 (1).zip', 'notes.txt', 'daylight-auto-2026-09-05-0703.zip.bak', 'Daylight-auto-2026-09-05-0703.zip']) {
      expect([name, isAutoBackupName(name)]).toEqual([name, false]);
    }
  });
});

describe('autoBackupDue', () => {
  const now = at('2026-09-15T18:00:00');
  it('needs a folder', () => {
    expect(autoBackupDue({ dir: null, lastAt: null, triedAt: null, error: null }, now)).toBe(false);
  });

  it('runs once per day', () => {
    expect(autoBackupDue({ dir: DIR, lastAt: null, triedAt: null, error: null }, now)).toBe(true);
    expect(autoBackupDue({ dir: DIR, lastAt: at('2026-09-15T07:00:00').toISOString(), triedAt: null, error: null }, now)).toBe(false);
    expect(autoBackupDue({ dir: DIR, lastAt: at('2026-09-14T23:00:00').toISOString(), triedAt: null, error: null }, now)).toBe(true);
  });

  it('waits an hour after a failure', () => {
    const tried = new Date(now.getTime() - AUTO_BACKUP_RETRY_MS + 60_000).toISOString();
    expect(autoBackupDue({ dir: DIR, lastAt: null, triedAt: tried, error: 'x' }, now)).toBe(false);
    const longAgo = new Date(now.getTime() - AUTO_BACKUP_RETRY_MS).toISOString();
    expect(autoBackupDue({ dir: DIR, lastAt: null, triedAt: longAgo, error: 'x' }, now)).toBe(true);
  });
});

describe('runAutoBackup', () => {
  it('does nothing while it is off', () => {
    const db = createTestDb();
    const folder = memoryFolder();
    expect(runAutoBackup({ db, folder, store: memoryPhotoStore(), appVersion: '1.0.0' })).toBe('off');
    expect(folder.files.size).toBe(0);
  });

  it('writes the same JSON backup as the manual one, readable by the import', () => {
    const db = setup();
    const folder = memoryFolder();
    const now = at('2026-09-15T18:00:00');
    expect(runAutoBackup({ db, folder, store: memoryPhotoStore(), appVersion: '1.0.0', now })).toBe('written');
    const [name] = [...folder.files.keys()];
    expect(name).toBe('daylight-auto-2026-09-15-1800.json');
    const pending = readImportBytes(name!, folder.files.get(name!)!);
    expect(pending.kind === 'json' && pending.payload.entries.map((entry) => entry.note)).toEqual(['Ein guter Tag']);
    expect(getSettings(db)).toMatchObject({ auto_backup_at: now.toISOString(), auto_backup_error: null });
    expect(getSettings(db).auto_backup_hash).toBeTruthy();
  });

  it('writes a ZIP with the photos as real files once there are photos', () => {
    const db = setup();
    const entry = createEntry(db, { date: '2026-09-02', time: '20:30', mood_id: 3 });
    setPhotos(db, entry.id, ['photo-a.jpg']);
    const photo = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
    const folder = memoryFolder();
    runAutoBackup({ db, folder, store: memoryPhotoStore({ 'photo-a.jpg': photo }), appVersion: '1.0.0', now: at('2026-09-15T18:00:00') });
    const [name] = [...folder.files.keys()];
    expect(name).toMatch(/\.zip$/);
    const files = unzipSync(folder.files.get(name!)!);
    expect(Object.keys(files).sort()).toEqual(['daylight.json', 'photos/photo-a.jpg']);
    expect(files['photos/photo-a.jpg']).toEqual(photo);
    const pending = readImportBytes(name!, folder.files.get(name!)!);
    expect(pending.kind === 'json' && pending.photos?.get('photo-a.jpg')).toEqual(photo);
  });

  it('keeps to once a day, skips unchanged data, and "Jetzt sichern" writes anyway', () => {
    const db = setup();
    const folder = memoryFolder();
    const store = memoryPhotoStore();
    runAutoBackup({ db, folder, store, appVersion: '1.0.0', now: at('2026-09-15T08:00:00') });
    createEntry(db, { date: '2026-09-15', time: '20:30', mood_id: 1 });
    expect(runAutoBackup({ db, folder, store, appVersion: '1.0.0', now: at('2026-09-15T20:31:00') })).toBe('throttled');
    expect(runAutoBackup({ db, folder, store, appVersion: '1.0.0', now: at('2026-09-16T08:00:00') })).toBe('written');
    expect(runAutoBackup({ db, folder, store, appVersion: '1.0.0', now: at('2026-09-17T08:00:00') })).toBe('unchanged');
    expect(runAutoBackup({ db, folder, store, appVersion: '1.0.0', now: at('2026-09-17T08:05:00'), force: true })).toBe('written');
    expect(folder.files.size).toBe(3);
  });

  it(`keeps the newest ${AUTO_BACKUP_KEEP} of its own and never touches other files`, () => {
    const db = setup();
    const foreign = { 'urlaub.jpg': new Uint8Array([1]), 'daylight-export-2026-01-01.json': new Uint8Array([2]), 'daylight-auto-2026-01-01-0800 (1).zip': new Uint8Array([3]) };
    const folder = memoryFolder(foreign);
    const store = memoryPhotoStore();
    for (let day = 1; day <= AUTO_BACKUP_KEEP + 3; day++) {
      createEntry(db, { date: `2026-10-${String(day).padStart(2, '0')}`, time: '20:30', mood_id: 2 });
      expect(runAutoBackup({ db, folder, store, appVersion: '1.0.0', now: new Date(2026, 9, day, 21, 0) })).toBe('written');
    }
    const own = [...folder.files.keys()].filter(isAutoBackupName).sort();
    expect(own).toHaveLength(AUTO_BACKUP_KEEP);
    expect(own[0]).toBe('daylight-auto-2026-10-04-2100.json');
    expect(own.at(-1)).toBe('daylight-auto-2026-10-10-2100.json');
    for (const name of Object.keys(foreign)) expect(folder.files.has(name)).toBe(true);
  });

  it('records a missing folder and leaves the app alone', () => {
    const db = setup();
    const folder = memoryFolder();
    folder.gone = true;
    const now = at('2026-09-15T18:00:00');
    expect(runAutoBackup({ db, folder, store: memoryPhotoStore(), appVersion: '1.0.0', now })).toBe('failed');
    expect(getSettings(db)).toMatchObject({ auto_backup_error: FOLDER_MISSING, auto_backup_tried_at: now.toISOString(), auto_backup_at: null });
    expect(classifyAutoBackupError(getSettings(db).auto_backup_error!)).toBe('folder');
    // Within the hour the next save does not try again; after it, a working folder clears the error.
    expect(runAutoBackup({ db, folder, store: memoryPhotoStore(), appVersion: '1.0.0', now: at('2026-09-15T18:30:00') })).toBe('throttled');
    folder.gone = false;
    expect(runAutoBackup({ db, folder, store: memoryPhotoStore(), appVersion: '1.0.0', now: at('2026-09-15T19:30:00') })).toBe('written');
    expect(getSettings(db).auto_backup_error).toBeNull();
  });

  it('removes a half written file when the disk is full and keeps the older backups', () => {
    const db = setup();
    const folder = memoryFolder();
    const store = memoryPhotoStore();
    runAutoBackup({ db, folder, store, appVersion: '1.0.0', now: at('2026-09-14T18:00:00') });
    createEntry(db, { date: '2026-09-15', time: '20:30', mood_id: 1 });
    folder.full = true;
    expect(runAutoBackup({ db, folder, store, appVersion: '1.0.0', now: at('2026-09-15T21:00:00') })).toBe('failed');
    expect([...folder.files.keys()]).toEqual(['daylight-auto-2026-09-14-1800.json']);
    expect(classifyAutoBackupError(getSettings(db).auto_backup_error!)).toBe('space');
  });

  it('a second run within the same minute replaces its own file instead of adding a copy', () => {
    const db = setup();
    const folder = memoryFolder();
    const now = at('2026-09-15T18:00:00');
    runAutoBackup({ db, folder, store: memoryPhotoStore(), appVersion: '1.0.0', now, force: true });
    runAutoBackup({ db, folder, store: memoryPhotoStore(), appVersion: '1.0.0', now, force: true });
    expect([...folder.files.keys()]).toEqual(['daylight-auto-2026-09-15-1800.json']);
  });
});

describe('pruneAutoBackups', () => {
  it('goes on when one old file will not go', () => {
    const names = Array.from({ length: 9 }, (_, i) => `daylight-auto-2026-10-0${i + 1}-0800.json`);
    const folder = memoryFolder(Object.fromEntries(names.map((name) => [name, new Uint8Array([1])])));
    const remove = folder.remove;
    folder.remove = (name) => {
      if (name === names[0]) throw new Error('busy');
      remove(name);
    };
    expect(pruneAutoBackups(folder, 7)).toEqual(names.slice(0, 2));
    expect(folder.files.has(names[0]!)).toBe(true);
    expect(folder.files.has(names[1]!)).toBe(false);
  });
});

describe('folderLabel', () => {
  it('reads the path out of a tree URI', () => {
    expect(folderLabel(DIR)).toBe('Documents/Daylight');
    expect(folderLabel('content://com.android.externalstorage.documents/tree/primary%3A')).toBe('primary');
    expect(folderLabel('content://x/tree/1234-ABCD%3ASync%2FDiary')).toBe('Sync/Diary');
    expect(folderLabel('weird')).toBe('weird');
  });
});
