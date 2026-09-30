import { allPhotoFileNames } from '@/db/repositories/photos';
import type { Database } from '@/db/types';

/**
 * Where photo files live. The app uses the private folder (`fileStore.ts`), tests an in-memory map.
 * Import, backup and cleanup only see this interface, so they run in Jest without a device.
 */
export interface PhotoStore {
  has(name: string): boolean;
  read(name: string): Uint8Array;
  write(name: string, bytes: Uint8Array): void;
  remove(name: string): void;
  list(): string[];
}

/** Letters, digits, dot, dash, underscore: never a path, whatever a file being imported claims. */
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function isPhotoName(name: string): boolean {
  return SAFE_NAME.test(name) && !name.includes('..');
}

export function assertPhotoName(name: string): string {
  if (!isPhotoName(name)) throw new Error(`Ungültiger Fotoname: ${name.slice(0, 60)}`);
  return name;
}

/** A fresh name for a photo taken in the app. */
export function newPhotoName(now = Date.now(), random = Math.random): string {
  const suffix = Math.floor(random() * 36 ** 6)
    .toString(36)
    .padStart(6, '0');
  return `photo-${now.toString(36)}-${suffix}.jpg`;
}

/** Daylio names its photos by checksum; keeping it lets a second import recognise them. */
export function daylioPhotoName(checksum: string): string {
  return `daylio-${checksum.toLowerCase().replace(/[^0-9a-f]/g, '')}.jpg`;
}

/** Deletes every file no row points to. Returns how many went. Never while an editor holds an unsaved photo. */
export function sweepPhotos(db: Database, store: PhotoStore): number {
  const used = allPhotoFileNames(db);
  let removed = 0;
  for (const name of store.list()) {
    if (used.has(name)) continue;
    store.remove(name);
    removed++;
  }
  return removed;
}

/** Writes the files an import brings along, skipping any already there. */
export function writePhotos(store: PhotoStore, files: ReadonlyMap<string, Uint8Array>, names: Iterable<string>): void {
  for (const name of names) {
    const bytes = files.get(name);
    if (bytes && !store.has(name)) store.write(assertPhotoName(name), bytes);
  }
}

export function memoryPhotoStore(initial: Record<string, Uint8Array> = {}): PhotoStore & { files: Map<string, Uint8Array> } {
  const files = new Map(Object.entries(initial));
  return {
    files,
    has: (name) => files.has(name),
    read: (name) => {
      const bytes = files.get(name);
      if (!bytes) throw new Error(`Foto fehlt: ${name}`);
      return bytes;
    },
    write: (name, bytes) => void files.set(assertPhotoName(name), bytes),
    remove: (name) => void files.delete(name),
    list: () => [...files.keys()],
  };
}
