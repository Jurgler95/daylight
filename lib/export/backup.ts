import { daysBetween, toDateString, today, type DateString } from '@/lib/dates';

/** About two months: long enough not to nag, short enough that a loss stays small. */
export const BACKUP_REMINDER_DAYS = 60;

export interface BackupStatus {
  /** Days since the last backup, or since the first entry when there never was one. */
  days: number | null;
  everExported: boolean;
  /** True once a reminder is warranted. False while there is nothing worth losing. */
  due: boolean;
}

/** Local calendar day of an ISO timestamp, or null when it is unusable. */
function timestampToDay(value: string | null): DateString | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : toDateString(date);
}

/**
 * Pure reminder rule. Without a backup the age of the oldest entry stands in for it,
 * so a user who never exported is still reminded once the data is worth something.
 */
export function backupStatus(input: { lastExportAt: string | null; firstEntryDate: DateString | null; now?: DateString }): BackupStatus {
  const now = input.now ?? today();
  const exportedOn = timestampToDay(input.lastExportAt);
  const reference = exportedOn ?? input.firstEntryDate;
  if (!reference) return { days: null, everExported: exportedOn !== null, due: false };
  const days = Math.max(0, daysBetween(reference, now));
  return { days, everExported: exportedOn !== null, due: days >= BACKUP_REMINDER_DAYS };
}
