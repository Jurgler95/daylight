import { BOM } from '@/lib/daylio/csv';

export type FileFormat = 'json' | 'daylio-csv' | 'unknown';

/**
 * Tells a Daylight JSON backup from a Daylio CSV by content, not by file name: Android's picker
 * often hands over names without extension. JSON starts with `{`, a Daylio CSV with its header.
 */
export function detectFormat(text: string): FileFormat {
  const start = (text.startsWith(BOM) ? text.slice(1) : text).trimStart();
  if (start.startsWith('{')) return 'json';
  const header = start.slice(0, start.search(/\r?\n|$/));
  if (/(^|,)"?full_date"?(,|$)/.test(header) && /(^|,)"?mood"?(,|$)/.test(header)) return 'daylio-csv';
  return 'unknown';
}
