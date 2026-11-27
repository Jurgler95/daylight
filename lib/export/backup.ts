import { daysBetween, toDateString, today, type DateString } from '@/lib/dates';

/**
 * About a month. It used to be two, but the card can now be put away and offers the automatic
 * backup, so it may come sooner: a month of entries is worth protecting.
 */
export const BACKUP_REMINDER_DAYS = 30;

/** A card put away stays away this long. */
export const BACKUP_HINT_SNOOZE_DAYS = 30;

/** A failing automatic backup gets a card once the last good backup is this old. */
export const AUTO_BACKUP_FAILING_DAYS = 3;

/** A put away card about a failing automatic backup comes back sooner than the plain reminder. */
export const AUTO_BACKUP_FAILING_SNOOZE_DAYS = 7;

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
export function backupStatus(input: { lastExportAt: string | null; autoBackupAt?: string | null; firstEntryDate: DateString | null; now?: DateString }): BackupStatus {
  const now = input.now ?? today();
  // The automatic backup is the same file, so whichever is newer counts.
  const manual = timestampToDay(input.lastExportAt);
  const auto = timestampToDay(input.autoBackupAt ?? null);
  const exportedOn = manual && auto ? (manual > auto ? manual : auto) : (manual ?? auto);
  const reference = exportedOn ?? input.firstEntryDate;
  if (!reference) return { days: null, everExported: exportedOn !== null, due: false };
  const days = Math.max(0, daysBetween(reference, now));
  return { days, everExported: exportedOn !== null, due: days >= BACKUP_REMINDER_DAYS };
}

export type BackupHint = 'none' | 'due' | 'failing';

/**
 * The card on "Heute". Nothing while the automatic backup works. `failing` when it is set up but
 * the last good backup is a few days old and the last try failed; `due` without automatic backup
 * once the usual reminder applies. Put away, the reminder stays away for a month, the failure for a week.
 */
export function backupHint(input: {
  status: BackupStatus;
  autoBackupOn: boolean;
  autoBackupError: string | null;
  dismissedOn: string | null;
  now?: DateString;
}): BackupHint {
  const now = input.now ?? today();
  const { status } = input;
  if (input.dismissedOn && /^\d{4}-\d{2}-\d{2}$/.test(input.dismissedOn)) {
    const snooze = input.autoBackupOn ? AUTO_BACKUP_FAILING_SNOOZE_DAYS : BACKUP_HINT_SNOOZE_DAYS;
    if (daysBetween(input.dismissedOn as DateString, now) < snooze) return 'none';
  }
  if (input.autoBackupOn) {
    if (!input.autoBackupError || status.days === null) return 'none';
    return status.days >= AUTO_BACKUP_FAILING_DAYS ? 'failing' : 'none';
  }
  return status.due ? 'due' : 'none';
}
