import { strFromU8, unzipSync } from 'fflate';
import { z } from 'zod';

import type { MoodLevel } from '@/db/schema';
import { isDateString, type DateString } from '@/lib/dates';
import { daylioPhotoName } from '@/lib/photos/store';
import { fold } from '@/lib/search/fold';

import { defaultMoods } from './known';
import { decodeNote, type ParsedDaylio, type RawEntry } from './parse';

/**
 * Daylio's own backup (`.daylio`): a ZIP with `backup.daylio`, Base64 of one JSON object, and the
 * photos under `assets/photos/<year>/<month>/<checksum>`, JPEG without extension. Read into the
 * same records as the CSV, plus photo file names, so the CSV planner and importer do the rest.
 * Layout read off a real backup (version 15, backup_version 2, Android).
 */

export const DAYLIO_BACKUP_ENTRY = 'backup.daylio';

export class DaylioBackupError extends Error {
  override readonly name = 'DaylioBackupError';
}

const moodSchema = z.object({
  id: z.number().int(),
  custom_name: z.string().nullish(),
  /** 1 (rad) to 5 (awful). */
  mood_group_id: z.number().int().min(1).max(5),
});

const tagSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  order: z.number().default(0),
  id_tag_group: z.number().int().nullish(),
});

const assetSchema = z.object({ id: z.number().int(), checksum: z.string().min(1), type: z.number().int() });

const backupSchema = z.object({
  customMoods: z.array(moodSchema),
  tags: z.array(tagSchema).default([]),
  tag_groups: z.array(z.object({ id: z.number().int(), order: z.number().default(0) })).default([]),
  dayEntries: z.array(z.unknown()),
  assets: z.array(assetSchema).default([]),
});

const entrySchema = z.object({
  year: z.number().int(),
  /** Zero-based, like Java's Calendar. */
  month: z.number().int().min(0).max(11),
  day: z.number().int().min(1).max(31),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  mood: z.number().int(),
  note: z.string().nullish(),
  note_title: z.string().nullish(),
  tags: z.array(z.number().int()).default([]),
  assets: z.array(z.number().int()).default([]),
  scaleValues: z.array(z.unknown()).default([]),
});

/** Asset type 1 is a photo; others (none seen so far) are left out. */
const PHOTO = 1;

const pad = (value: number) => String(value).padStart(2, '0');

/** True for the bytes of a ZIP file ("PK\3\4"). */
export function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** ZIP entries by name, a leading "/" dropped (Daylio writes absolute names). */
export function unzip(bytes: Uint8Array): Map<string, Uint8Array> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new DaylioBackupError('ZIP-Datei nicht lesbar');
  }
  return new Map(Object.entries(files).map(([name, data]) => [name.replace(/^\/+/, ''), data]));
}

function decodeBase64(text: string): string {
  const clean = text.replace(/\s+/g, '');
  if (typeof atob === 'function') return strFromU8(Uint8Array.from(atob(clean), (char) => char.charCodeAt(0)));
  return Buffer.from(clean, 'base64').toString('utf8');
}

/** Standard mood names in Daylight's language, so a backup lands on the moods a CSV import found. */
function moodName(mood: z.infer<typeof moodSchema>): { name: string; level: MoodLevel } {
  const level = (6 - mood.mood_group_id) as MoodLevel;
  const custom = mood.custom_name?.trim();
  return { name: custom || (defaultMoods().find((m) => m.level === level)?.label ?? String(level)), level };
}

/** Parses a whole `.daylio` file. Throws `DaylioBackupError` when it is no Daylio backup at all. */
export function parseDaylioBackup(bytes: Uint8Array): ParsedDaylio {
  return parseDaylioBackupFiles(unzip(bytes));
}

/** Same, for a ZIP already unpacked with `unzip`. */
export function parseDaylioBackupFiles(files: ReadonlyMap<string, Uint8Array>): ParsedDaylio {
  const encoded = files.get(DAYLIO_BACKUP_ENTRY);
  if (!encoded) throw new DaylioBackupError('backup.daylio fehlt');
  let raw: unknown;
  try {
    raw = JSON.parse(decodeBase64(strFromU8(encoded)));
  } catch {
    throw new DaylioBackupError('backup.daylio nicht lesbar');
  }
  const parsedBackup = backupSchema.safeParse(raw);
  if (!parsedBackup.success) throw new DaylioBackupError('backup.daylio hat ein unbekanntes Format');
  const backup = parsedBackup.data;

  const moods = new Map(backup.customMoods.map((mood) => [mood.id, moodName(mood)]));
  const groupOrder = new Map(backup.tag_groups.map((group) => [group.id, group.order]));
  const tags = new Map(backup.tags.map((tag) => [tag.id, tag]));
  // Daylio's display order (group, then tag), so `fileOrder` sees the same chains as in a CSV.
  const tagRank = (id: number) => {
    const tag = tags.get(id);
    return tag ? (groupOrder.get(tag.id_tag_group ?? -1) ?? 0) * 1e6 + tag.order : Number.MAX_SAFE_INTEGER;
  };

  const photoFiles = new Map<string, Uint8Array>();
  for (const [name, data] of files) {
    const match = /^assets\/photos\/(?:.*\/)?([0-9a-f]+)$/i.exec(name);
    if (match) photoFiles.set(daylioPhotoName(match[1] as string), data);
  }
  const photoNames = new Map(backup.assets.filter((asset) => asset.type === PHOTO).map((asset) => [asset.id, daylioPhotoName(asset.checksum)]));

  const result: ParsedDaylio = { entries: [], errors: [], warnings: [], photoFiles };
  backup.dayEntries.forEach((value, index) => {
    const line = index + 1;
    const parsed = entrySchema.safeParse(value);
    if (!parsed.success) {
      result.errors.push({ line, code: 'entry', value: '' });
      return;
    }
    const entry = parsed.data;
    const date = `${entry.year}-${pad(entry.month + 1)}-${pad(entry.day)}`;
    if (!isDateString(date)) {
      result.errors.push({ line, code: 'date', value: date });
      return;
    }
    const mood = moods.get(entry.mood);
    if (!mood) {
      result.errors.push({ line, code: 'mood', value: String(entry.mood) });
      return;
    }
    const names: string[] = [];
    const seen = new Set<string>();
    for (const id of [...entry.tags].sort((a, b) => tagRank(a) - tagRank(b))) {
      const name = tags.get(id)?.name.trim();
      if (!name) continue;
      if (seen.has(fold(name))) result.warnings.push({ line, code: 'duplicateActivity', value: name });
      else names.push(name);
      seen.add(fold(name));
    }
    if (entry.scaleValues.length > 0) result.warnings.push({ line, code: 'scales', value: String(entry.scaleValues.length) });
    const photos: string[] = [];
    for (const id of entry.assets) {
      const name = photoNames.get(id);
      if (!name) continue;
      if (photoFiles.has(name)) photos.push(name);
      else result.warnings.push({ line, code: 'photoMissing', value: `${date} ${pad(entry.hour)}:${pad(entry.minute)}` });
    }
    const record: RawEntry = {
      line,
      date: date as DateString,
      time: `${pad(entry.hour)}:${pad(entry.minute)}`,
      mood: mood.name,
      activities: names,
      scales: [],
      noteTitle: decodeNote(entry.note_title ?? ''),
      note: decodeNote(entry.note ?? ''),
      photos,
    };
    result.entries.push(record);
  });
  return result;
}
