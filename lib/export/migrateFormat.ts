import { EXPORT_APP, EXPORT_SCHEMA_VERSION } from './schema';

export class ImportFormatError extends Error {
  override readonly name = 'ImportFormatError';
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
    throw new ImportFormatError('Datei enthält kein Export-Objekt');
  }
  let payload = raw as Record<string, unknown>;
  if (payload.app !== EXPORT_APP) throw new ImportFormatError('Keine Daylight-Sicherung');
  const version = payload.schema_version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ImportFormatError('schema_version fehlt');
  }
  if (version > EXPORT_SCHEMA_VERSION) {
    throw new ImportFormatError(`schema_version ${version} ist neuer als diese App (${EXPORT_SCHEMA_VERSION})`);
  }
  for (let v = version; v < EXPORT_SCHEMA_VERSION; v++) {
    const step = STEPS[v];
    if (!step) throw new ImportFormatError(`Kein Migrationsschritt von Version ${v}`);
    payload = { ...step(payload), schema_version: v + 1 };
  }
  return payload;
}
