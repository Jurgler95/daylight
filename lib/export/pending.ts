import { strFromU8 } from 'fflate';
import { create } from 'zustand';

import type { Database } from '@/db/types';
import { applyDaylioImport, type ImportMode } from '@/lib/daylio/apply';
import { DAYLIO_BACKUP_ENTRY, isZip, parseDaylioBackupFiles, unzip } from '@/lib/daylio/backup';
import { parseDaylioCsv, type ParsedDaylio } from '@/lib/daylio/parse';
import type { ImportChoices } from '@/lib/daylio/plan';
import type { PhotoStore } from '@/lib/photos/store';

import { isBackupArchive, readBackupArchive } from './archive';
import { detectFormat } from './detect';
import { applyImport, parseImport } from './import';
import type { ExportPayload } from './schema';

/**
 * A picked file, parsed and validated, waiting in the import preview. `csv` covers everything
 * Daylio produces (CSV and `.daylio` backup), `json` a Daylight backup, with photos when it was a ZIP.
 */
export type PendingImport =
  | { kind: 'csv'; name: string; parsed: ParsedDaylio }
  | { kind: 'json'; name: string; payload: ExportPayload; photos?: ReadonlyMap<string, Uint8Array> };

export class UnknownFormatError extends Error {
  override readonly name = 'UnknownFormatError';
}

/** Like `readImportFile`, for the raw bytes: a ZIP is a Daylio or Daylight backup, anything else is text. */
export function readImportBytes(name: string, bytes: Uint8Array): PendingImport {
  if (!isZip(bytes)) return readImportFile(name, strFromU8(bytes));
  const files = unzip(bytes);
  if (files.has(DAYLIO_BACKUP_ENTRY)) return { kind: 'csv', name, parsed: parseDaylioBackupFiles(files) };
  if (!isBackupArchive(files)) throw new UnknownFormatError(name);
  const { payload, photos } = readBackupArchive(files);
  return { kind: 'json', name, payload, photos };
}

/** Detects the format and parses the whole file. Throws on anything unreadable; never touches the database. */
export function readImportFile(name: string, text: string): PendingImport {
  const format = detectFormat(text);
  if (format === 'json') return { kind: 'json', name, payload: parseImport(text) };
  if (format === 'daylio-csv') return { kind: 'csv', name, parsed: parseDaylioCsv(text) };
  throw new UnknownFormatError(name);
}

export interface ApplyOptions {
  mode: ImportMode;
  choices?: ImportChoices;
  skipErrors?: boolean;
  /** Where photos go; without one, a file's photos are left out. */
  store?: PhotoStore;
}

/** Writes a pending import in one transaction and returns how many entries were added. */
export function applyPendingImport(db: Database, file: PendingImport, options: ApplyOptions): number {
  if (file.kind === 'json') return applyImport(db, file.payload, options.mode, { store: options.store, files: file.photos }).added;
  return applyDaylioImport(db, file.parsed, options).added;
}

/** Hands the parsed file from "Mehr" to the preview screen. */
export const usePendingImport = create<{ file: PendingImport | null; set: (file: PendingImport | null) => void }>((set) => ({
  file: null,
  set: (file) => set({ file }),
}));
