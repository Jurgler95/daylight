import { useMemo } from 'react';
import { create } from 'zustand';

interface DataVersionState {
  version: number;
  bump: () => void;
}

/** Bumped after every write so that screens re-read the (synchronous) database. */
export const useDataVersion = create<DataVersionState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

/** Runs a synchronous read and re-runs it whenever data changes or `deps` change. */
export function useQuery<T>(read: () => T, deps: readonly unknown[]): T {
  const version = useDataVersion((s) => s.version);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(read, [version, ...deps]);
}

const shared = new Map<string, unknown>();
let sharedVersion = -1;

/**
 * Computes `read` once per data version and key, however many screens ask for it. Everything a key
 * depends on besides the database (dates, settings) has to be part of the key. Dropped on every write.
 */
export function cached<T>(key: string, read: () => T): T {
  const { version } = useDataVersion.getState();
  if (version !== sharedVersion) {
    shared.clear();
    sharedVersion = version;
  }
  if (shared.has(key)) return shared.get(key) as T;
  const value = read();
  shared.set(key, value);
  return value;
}

/** Runs a write and notifies every `useQuery` subscriber. */
export function mutate<T>(write: () => T): T {
  const result = write();
  useDataVersion.getState().bump();
  return result;
}
