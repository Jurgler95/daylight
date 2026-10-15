import { useRef, useState } from 'react';

import { getDb } from '@/db';
import { deleteEntry, entryIdOnDate, getEntryDetails, saveEntry, turningPointLostBy } from '@/db/repositories/entries';
import type { TurningPoint } from '@/db/schema';
import { nowTime, today, type DateString } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { filePhotoStore } from '@/lib/photos/fileStore';
import { mutate, useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { celebrateSave } from '@/lib/streak/celebrate';

import { defaultTime, draftFromEntry, draftToInput, newDraft, sameDraft, type EntryDraft } from './draft';

export type EditorTarget = { kind: 'new'; date: DateString; moodId: number | null } | { kind: 'edit'; id: number };

export interface EntryEditor {
  /** Null when the entry to edit no longer exists. */
  draft: EntryDraft | null;
  isNew: boolean;
  /** Something changed since the editor opened; closing now would lose it. */
  dirty: boolean;
  /** A mood is picked and the day is free. */
  canSave: boolean;
  /** The draft was moved to a day that already has an entry; one entry per day. */
  dayTaken: boolean;
  /** The turning point that goes when this entry is deleted, or saved on another day, since it is the last of its day. */
  turningPointLostOnDelete: TurningPoint | undefined;
  turningPointLostOnSave: TurningPoint | undefined;
  update: (patch: Partial<EntryDraft>) => void;
  /** Writes the draft; false when it cannot be saved yet or was already saved. */
  save: () => boolean;
  remove: () => void;
}

/** Files of photos that are gone from the database; failing to delete one only leaves it for the next sweep. */
function removePhotoFiles(names: readonly string[]): void {
  for (const name of names) {
    try {
      filePhotoStore.remove(name);
    } catch {
      // Swept on the next start.
    }
  }
}

/**
 * The editor keeps its own draft and writes only on "Speichern". The text fields are controlled,
 * so the draft always holds every keystroke; closing with changes asks first (see the screen).
 */
export function useEntryEditor(target: EditorTarget): EntryEditor {
  const reminderTime = useSettingsStore((s) => s.settings?.reminder_time ?? '20:30');
  const [initial] = useState<EntryDraft | null>(() => {
    if (target.kind === 'new') return newDraft(target.date, defaultTime(target.date, today(), nowTime(), reminderTime), target.moodId);
    const entry = getEntryDetails(getDb(), target.id);
    return entry ? draftFromEntry(entry) : null;
  });
  const [draft, setDraft] = useState<EntryDraft | null>(initial);
  const input = draft ? draftToInput(draft) : null;
  const id = target.kind === 'edit' ? target.id : null;
  const date = draft?.date ?? null;
  const moved = date !== null && date !== initial?.date;
  // Only a moved entry is checked, so a day imported with several entries can still be edited.
  const isTaken = (day: string) => (id === null || day !== initial?.date) && entryIdOnDate(getDb(), day, id) !== undefined;
  // Set once the draft is written or the entry deleted: a second tap before the editor has closed
  // must not write again. The state keeps the closing editor from reading its own entry as taken.
  const done = useRef(false);
  const [closing, setClosing] = useState(false);
  // Read again when the day or the data changes, not on every keystroke.
  const dayTaken = useQuery(() => !closing && date !== null && isTaken(date), [closing, date, id]);
  const turningPointLostOnDelete = useQuery(() => (id !== null ? turningPointLostBy(getDb(), id) : undefined), [id]);
  const turningPointLostOnSave = useQuery(() => (id !== null && moved ? turningPointLostBy(getDb(), id, date ?? undefined) : undefined), [id, date, moved]);

  return {
    draft,
    isNew: id === null,
    dirty: draft !== null && initial !== null && !sameDraft(draft, initial),
    canSave: input !== null && !dayTaken,
    dayTaken,
    turningPointLostOnDelete,
    turningPointLostOnSave,
    update: (patch) => setDraft((current) => (current ? { ...current, ...patch } : current)),
    save: () => {
      // Checked against the database as it is now, since another editor may have taken the day meanwhile.
      if (done.current || !input || isTaken(input.date)) return false;
      const celebration = celebrateSave(() => mutate(() => saveEntry(getDb(), id, input)));
      done.current = true;
      setClosing(true);
      removePhotoFiles((initial?.photos ?? []).filter((name) => !input.photos?.includes(name)));
      // A celebration brings its own buzz when it shows; one is enough.
      if (!celebration) haptics.confirm();
      return true;
    },
    remove: () => {
      if (id === null || done.current) return;
      done.current = true;
      setClosing(true);
      removePhotoFiles(mutate(() => deleteEntry(getDb(), id)));
    },
  };
}
