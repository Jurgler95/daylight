import { useState } from 'react';

import { getDb } from '@/db';
import { deleteEntry, entryIdOnDate, getEntryDetails, saveEntry } from '@/db/repositories/entries';
import { nowTime, today, type DateString } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { filePhotoStore } from '@/lib/photos/fileStore';
import { mutate } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

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
  update: (patch: Partial<EntryDraft>) => void;
  /** Writes the draft; false when it cannot be saved yet. */
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
  // Only a moved entry is checked, so a day imported with several entries can still be edited.
  const dayTaken = draft !== null && (id === null || draft.date !== initial?.date) && entryIdOnDate(getDb(), draft.date, id) !== undefined;

  return {
    draft,
    isNew: id === null,
    dirty: draft !== null && initial !== null && !sameDraft(draft, initial),
    canSave: input !== null && !dayTaken,
    dayTaken,
    update: (patch) => setDraft((current) => (current ? { ...current, ...patch } : current)),
    save: () => {
      if (!input || dayTaken) return false;
      mutate(() => saveEntry(getDb(), id, input));
      removePhotoFiles((initial?.photos ?? []).filter((name) => !input.photos?.includes(name)));
      haptics.confirm();
      return true;
    },
    remove: () => {
      if (id !== null) removePhotoFiles(mutate(() => deleteEntry(getDb(), id)));
    },
  };
}
