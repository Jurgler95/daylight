import { formatDayMonth, formatWeekdayLong, type DateString } from '@/lib/dates';

import { BOM, formatCsvRow } from './csv';
import { ACTIVITY_SEPARATOR, DAYLIO_COLUMNS, type RawScale } from './parse';

/**
 * Daylight's journal as a Daylio CSV, byte for byte in Daylio's layout: BOM, the same header,
 * German `date` and `weekday`, `\n` between lines and none after the last, the first five columns
 * quoted only when needed and the last four always, line breaks in notes as `<br>`, newest first.
 */

export interface DaylioRow {
  date: DateString;
  time: string;
  mood: string;
  /** Already in display order (group order, then order inside the group). */
  activities: readonly string[];
  scales: readonly RawScale[];
  noteTitle: string | null;
  note: string | null;
}

const ALWAYS_QUOTED = new Set(['activities', 'scales', 'note_title', 'note']);
const alwaysQuote = (column: number) => ALWAYS_QUOTED.has(DAYLIO_COLUMNS[column] ?? '');

function encodeNote(value: string | null): string {
  return (value ?? '').replace(/\r\n|\r|\n/g, '<br>');
}

/** Newest first; rows on the same day and time keep their reversed input order. */
export function writeDaylioCsv(rows: readonly DaylioRow[]): string {
  const sorted = [...rows].reverse().sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)));
  const lines = sorted.map((row) =>
    formatCsvRow(
      [
        row.date,
        formatDayMonth(row.date),
        formatWeekdayLong(row.date),
        row.time,
        row.mood,
        row.activities.join(ACTIVITY_SEPARATOR),
        row.scales.map((scale) => `${scale.name}: ${scale.value}`).join(ACTIVITY_SEPARATOR),
        encodeNote(row.noteTitle),
        encodeNote(row.note),
      ],
      alwaysQuote,
    ),
  );
  return BOM + [DAYLIO_COLUMNS.join(','), ...lines].join('\n');
}

export function daylioFileName(date: string): string {
  return `daylight-daylio-${date}.csv`;
}
