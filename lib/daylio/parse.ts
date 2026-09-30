import { z } from 'zod';

import { isDateString, type DateString } from '@/lib/dates';
import { fold } from '@/lib/search/fold';

import { CsvSyntaxError, parseCsv } from './csv';

/**
 * Daylio CSV to raw records. Pure: no database, no React. Every row is validated with zod before
 * anything else happens; bad rows are collected with line number and reason instead of aborting.
 */

export const DAYLIO_COLUMNS = ['full_date', 'date', 'weekday', 'time', 'mood', 'activities', 'scales', 'note_title', 'note'] as const;
const REQUIRED_COLUMNS = ['full_date', 'time', 'mood'] as const;

export const ACTIVITY_SEPARATOR = ' | ';

export interface RawScale {
  name: string;
  value: number;
}

/** One Daylio row, cleaned up: 24h time, text notes, activity names in file order. */
export interface RawEntry {
  line: number;
  date: DateString;
  time: string;
  mood: string;
  activities: string[];
  scales: RawScale[];
  noteTitle: string | null;
  note: string | null;
  /** Photo file names (only a Daylio backup has any); the bytes are in `ParsedDaylio.photoFiles`. */
  photos: string[];
}

/** `entry`: a record of a Daylio backup that does not have the expected fields. */
export type RowErrorCode = 'columns' | 'date' | 'time' | 'mood' | 'entry';
export interface RowError {
  line: number;
  code: RowErrorCode;
  /** The offending value, for display. */
  value: string;
}

/**
 * Not an error: the row imports, but not quite as written. `scales`: the column was not understood
 * (its format is unverified). `duplicateActivity`: a name appears twice in one row, which Daylio
 * allows for two activities of the same name in different groups; without groups in the CSV the
 * entry keeps it once. `photoMissing`: a backup entry names a photo the file does not contain.
 */
export interface RowWarning {
  line: number;
  code: 'scales' | 'duplicateActivity' | 'photoMissing';
  value: string;
}

export interface ParsedDaylio {
  entries: RawEntry[];
  errors: RowError[];
  warnings: RowWarning[];
  /** Photo bytes by file name, from a Daylio backup; absent for a CSV. */
  photoFiles?: ReadonlyMap<string, Uint8Array>;
}

export class DaylioFormatError extends Error {
  override readonly name = 'DaylioFormatError';
  constructor(
    readonly code: 'header' | 'syntax',
    readonly line: number,
  ) {
    super(code === 'header' ? 'Keine Daylio-Kopfzeile' : `CSV-Fehler in Zeile ${line}`);
  }
}

/** True when the first record looks like a Daylio export header. */
export function isDaylioHeader(fields: readonly string[]): boolean {
  const names = new Set(fields.map((field) => field.trim()));
  return REQUIRED_COLUMNS.every((column) => names.has(column)) && names.has('activities');
}

/** "21:35", "8:30 pm", "12:05 AM" to "HH:mm"; null when unreadable. */
export function parseTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(value.trim());
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const suffix = match[3]?.toLowerCase();
  if (minutes > 59) return null;
  if (suffix) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (suffix === 'pm' ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0' };

/** `<br>` to a line break, HTML entities to characters. Empty text becomes null. */
export function decodeNote(value: string): string | null {
  const text = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
      if (name[0] === '#') {
        const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
      }
      return ENTITIES[name.toLowerCase()] ?? whole;
    });
  return text === '' ? null : text;
}

/** Activity names in file order, each (folded) name once; `repeated` lists the ones dropped. */
export function splitActivities(value: string): { names: string[]; repeated: string[] } {
  const names: string[] = [];
  const repeated: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split('|')) {
    const name = part.trim();
    if (name === '') continue;
    if (seen.has(fold(name))) repeated.push(name);
    else names.push(name);
    seen.add(fold(name));
  }
  return { names, repeated };
}

/** `Name: Wert` pairs separated by ` | `. Anything else is reported, not guessed. */
export function parseScales(value: string): { scales: RawScale[]; unreadable: boolean } {
  if (value.trim() === '') return { scales: [], unreadable: false };
  const scales: RawScale[] = [];
  let unreadable = false;
  for (const part of value.split('|')) {
    const match = /^\s*(.+?)\s*:\s*(-?\d+)\s*$/.exec(part);
    if (match) scales.push({ name: match[1] as string, value: Number(match[2]) });
    else unreadable = true;
  }
  return { scales, unreadable };
}

const rowSchema = z.object({
  full_date: z.string().refine((value): boolean => isDateString(value), 'date'),
  time: z.string().refine((value): boolean => parseTime(value) !== null, 'time'),
  mood: z.string().trim().min(1, 'mood'),
  activities: z.string().default(''),
  scales: z.string().default(''),
  note_title: z.string().default(''),
  note: z.string().default(''),
});

/** Parses a whole Daylio export. Throws `DaylioFormatError` only for a missing header or broken quoting. */
export function parseDaylioCsv(text: string): ParsedDaylio {
  let records;
  try {
    records = parseCsv(text);
  } catch (error) {
    if (error instanceof CsvSyntaxError) throw new DaylioFormatError('syntax', error.line);
    throw error;
  }
  const [header, ...rows] = records;
  if (!header || !isDaylioHeader(header.fields)) throw new DaylioFormatError('header', 1);
  const columns = header.fields.map((field) => field.trim());

  const result: ParsedDaylio = { entries: [], errors: [], warnings: [] };
  for (const { line, fields } of rows) {
    if (fields.length !== columns.length) {
      result.errors.push({ line, code: 'columns', value: String(fields.length) });
      continue;
    }
    const raw = Object.fromEntries(columns.map((column, i) => [column, fields[i]]));
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const code = (issue?.message ?? 'date') as RowErrorCode;
      const field = code === 'date' ? 'full_date' : code;
      result.errors.push({ line, code, value: String(raw[field] ?? '') });
      continue;
    }
    const row = parsed.data;
    const { scales, unreadable } = parseScales(row.scales);
    if (unreadable) result.warnings.push({ line, code: 'scales', value: row.scales });
    const activities = splitActivities(row.activities);
    for (const name of activities.repeated) result.warnings.push({ line, code: 'duplicateActivity', value: name });
    result.entries.push({
      line,
      date: row.full_date as DateString,
      time: parseTime(row.time) as string,
      mood: row.mood,
      activities: activities.names,
      scales,
      noteTitle: decodeNote(row.note_title),
      note: decodeNote(row.note),
      photos: [],
    });
  }
  return result;
}
