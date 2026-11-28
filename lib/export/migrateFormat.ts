import { EXPORT_APP, EXPORT_SCHEMA_VERSION } from './schema';

/**
 * Why a JSON file cannot be read, as a key under `settings.importError` in the locales: not a
 * Daylight backup at all, one that is cut off or broken, or one from a newer app version.
 * The message stays technical and English, for logs and tests; the screen shows the key's text.
 */
export type ImportFormatCode = 'notBackup' | 'damaged' | 'newer';

export class ImportFormatError extends Error {
  override readonly name = 'ImportFormatError';
  constructor(
    readonly code: ImportFormatCode,
    message: string,
  ) {
    super(message);
  }
}

type Step = (payload: Record<string, unknown>) => Record<string, unknown>;

/**
 * Chain of format upgrades keyed by the version they upgrade FROM.
 * Adding schema_version 2 means: bump EXPORT_SCHEMA_VERSION and add `1: (p) => ...` here.
 */
const STEPS: Record<number, Step> = {
  // Version 2 knows photos; a version 1 backup has none.
  1: (payload) => ({ ...payload, entry_photos: [] }),
};

/** Brings any supported export up to the current schema_version before zod validation. */
export function migrateExportFormat(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ImportFormatError('notBackup', 'not an export object');
  }
  let payload = raw as Record<string, unknown>;
  if (payload.app !== EXPORT_APP) throw new ImportFormatError('notBackup', 'not a Daylight backup');
  const version = payload.schema_version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ImportFormatError('damaged', 'schema_version missing');
  }
  if (version > EXPORT_SCHEMA_VERSION) {
    throw new ImportFormatError('newer', `schema_version ${version} is newer than this app (${EXPORT_SCHEMA_VERSION})`);
  }
  for (let v = version; v < EXPORT_SCHEMA_VERSION; v++) {
    const step = STEPS[v];
    if (!step) throw new ImportFormatError('damaged', `no migration step from version ${v}`);
    payload = { ...step(payload), schema_version: v + 1 };
  }
  return payload;
}
