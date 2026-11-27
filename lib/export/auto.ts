import { strToU8 } from 'fflate';

import { getSettings, updateSettings } from '@/db/repositories/settings';
import type { Database } from '@/db/types';
import { toDateString } from '@/lib/dates';
import type { PhotoStore } from '@/lib/photos/store';

import { writeBackupArchive } from './archive';
import type { ExportPayload } from './schema';
import { buildExport } from './serialize';

/**
 * The automatic backup: the same file as "Sicherung in Ordner speichern", written by the app itself
 * into a folder the user picked once. No background work: it runs when the app starts and after
 * changes (`useAutoBackup`), at most once a day and only when the data changed since the last one.
 */

/** How many automatic backups stay in the folder; older ones of our own go. */
export const AUTO_BACKUP_KEEP = 7;

/** After a failed attempt the next one waits this long, so a missing folder is not tried after every save. */
export const AUTO_BACKUP_RETRY_MS = 60 * 60 * 1000;

/** Stored as the error when the folder is gone or the app lost its permission for it. */
export const FOLDER_MISSING = 'folder-missing';

/** `daylight-auto-YYYY-MM-DD-HHmm.zip` or `.json`. Only names like this are ever deleted. */
const OWN_NAME = /^daylight-auto-\d{4}-\d{2}-\d{2}-\d{4}\.(zip|json)$/;

export function isAutoBackupName(name: string): boolean {
  return OWN_NAME.test(name);
}

/** Local date and time in the name, so the files sort by age and read well in any file manager. */
export function autoBackupFileName(at: Date, zip: boolean): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `daylight-auto-${toDateString(at)}-${pad(at.getHours())}${pad(at.getMinutes())}.${zip ? 'zip' : 'json'}`;
}

/** The picked folder, as far as the backup needs it. The app uses Android's storage access (`autoFolder.ts`), tests a map. */
export interface BackupFolder {
  /** False when the folder is gone or no longer granted. */
  exists(): boolean;
  /** Names of the files directly inside. */
  list(): string[];
  write(name: string, mimeType: string, bytes: Uint8Array): void;
  remove(name: string): void;
}

/** FNV-1a over the JSON: cheap, and enough to tell whether anything changed. */
function fingerprint(payload: ExportPayload): string {
  const { exported_at: _e, ...data } = payload;
  const text = JSON.stringify(data);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16)}-${text.length}`;
}

export interface AutoBackupState {
  dir: string | null;
  lastAt: string | null;
  triedAt: string | null;
  error: string | null;
}

/**
 * Pure throttle before any work: a folder is set, today has no backup yet and the last failure
 * is an hour old. Whether the data changed is checked afterwards, against the fingerprint.
 */
export function autoBackupDue(state: AutoBackupState, now: Date): boolean {
  if (!state.dir) return false;
  if (state.error && state.triedAt) {
    const tried = Date.parse(state.triedAt);
    if (!Number.isNaN(tried) && now.getTime() - tried < AUTO_BACKUP_RETRY_MS) return false;
  }
  if (!state.lastAt) return true;
  const last = new Date(state.lastAt);
  return Number.isNaN(last.getTime()) || toDateString(last) !== toDateString(now);
}

/** Deletes our own backups beyond the newest `keep`. Anything else in the folder is never touched. */
export function pruneAutoBackups(folder: BackupFolder, keep = AUTO_BACKUP_KEEP): string[] {
  const own = folder.list().filter(isAutoBackupName).sort();
  const old = own.slice(0, Math.max(0, own.length - keep));
  for (const name of old) {
    try {
      folder.remove(name);
    } catch {
      // A file that will not go stays until the next run; the new backup is written either way.
    }
  }
  return old;
}

function toBytes(payload: ExportPayload, store: PhotoStore): { bytes: Uint8Array; zip: boolean } {
  if (payload.entry_photos.length === 0) return { bytes: strToU8(JSON.stringify(payload, null, 2)), zip: false };
  const chunks: Uint8Array[] = [];
  let size = 0;
  writeBackupArchive(payload, store, (chunk) => {
    chunks.push(chunk);
    size += chunk.length;
  });
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return { bytes, zip: true };
}

export type AutoBackupResult = 'off' | 'throttled' | 'unchanged' | 'written' | 'failed';

export interface AutoBackupOptions {
  db: Database;
  folder: BackupFolder;
  store: PhotoStore;
  appVersion: string;
  now?: Date;
  /** "Jetzt sichern": skips the daily limit and the unchanged check. */
  force?: boolean;
}

/**
 * One run. Never throws: a failure is stored in the settings for "Automatische Sicherung" to show,
 * and the app carries on. The new file is complete before old ones are deleted.
 */
export function runAutoBackup({ db, folder, store, appVersion, now = new Date(), force = false }: AutoBackupOptions): AutoBackupResult {
  const settings = getSettings(db);
  const state: AutoBackupState = {
    dir: settings.auto_backup_dir,
    lastAt: settings.auto_backup_at,
    triedAt: settings.auto_backup_tried_at,
    error: settings.auto_backup_error,
  };
  if (!state.dir) return 'off';
  if (!force && !autoBackupDue(state, now)) return 'throttled';
  const at = now.toISOString();

  let name: string | null = null;
  try {
    if (!folder.exists()) throw new Error(FOLDER_MISSING);
    const payload = buildExport(db, appVersion, at);
    const hash = fingerprint(payload);
    if (!force && hash === settings.auto_backup_hash && !state.error) return 'unchanged';
    const { bytes, zip } = toBytes(payload, store);
    name = autoBackupFileName(now, zip);
    // A run within the same minute ("Jetzt sichern" twice) replaces its own file instead of getting " (1)".
    if (folder.list().includes(name)) folder.remove(name);
    folder.write(name, zip ? 'application/zip' : 'application/json', bytes);
    updateSettings(db, { auto_backup_at: at, auto_backup_tried_at: at, auto_backup_error: null, auto_backup_hash: hash });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Half a file is worse than none: it would look like a backup and fail on restore.
    if (name) {
      try {
        if (folder.list().includes(name)) folder.remove(name);
      } catch {
        // The folder itself is the problem; nothing more to tidy.
      }
    }
    try {
      updateSettings(db, { auto_backup_tried_at: at, auto_backup_error: message.slice(0, 300) || 'unknown' });
    } catch {
      // Even the settings could not be written; the next start tries again.
    }
    return 'failed';
  }
  try {
    pruneAutoBackups(folder);
  } catch {
    // Old files staying a little longer is harmless.
  }
  return 'written';
}

export type AutoBackupError = 'folder' | 'space' | 'other';

/** What the settings screen says about a stored error. */
export function classifyAutoBackupError(message: string): AutoBackupError {
  if (message === FOLDER_MISSING || /permission|denied|securityexception|not found|does not exist|no such/i.test(message)) return 'folder';
  if (/ENOSPC|no space|not enough space|storage full|disk full/i.test(message)) return 'space';
  return 'other';
}

/**
 * Readable folder name from a tree URI of Android's folder picker:
 * `content://…/tree/primary%3ADocuments%2FDaylight` becomes `Documents/Daylight`.
 */
export function folderLabel(uri: string): string {
  const match = /\/tree\/([^/]+)/.exec(uri);
  if (!match?.[1]) return uri;
  let id: string;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return uri;
  }
  const colon = id.indexOf(':');
  const path = colon >= 0 ? id.slice(colon + 1) : id;
  return path || id.replace(/:$/, '');
}
