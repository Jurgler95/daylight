import { useRef, useState } from 'react';

import { getDb } from '@/db';
import { deleteEntry, getEntryDetails, saveEntry, turningPointLostBy } from '@/db/repositories/entries';
import { setExperimentDays } from '@/db/repositories/experiments';
import type { Experiment, TurningPoint } from '@/db/schema';
import { nowTime, today, type DateString } from '@/lib/dates';
import { useToday } from '@/lib/dates/useToday';
import { askingOn, endDateAfterNo } from '@/lib/experiments/rules';
import { useExperimentAnswers, useExperiments } from '@/lib/experiments/useExperiments';
import { haptics } from '@/lib/haptics';
import { filePhotoStore } from '@/lib/photos/fileStore';
import { noteSaveForReview } from '@/lib/review/useReviewPrompt';
import { mutate, useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { celebrateSave } from '@/lib/streak/celebrate';

import { checkInAnswer, defaultTime, draftFromEntry, draftToInput, newDraft, sameDraft, tapCheckIn, type EntryDraft } from './draft';

/** "Kept today?" for one experiment that asks on the draft's day. */
export interface CheckInRow {
  experiment: Experiment;
  answer: boolean | null;
  /** Set while a "no" waits for "Speichern": the day the experiment will then end on. */
  endsOn: DateString | null;
}

export type EditorTarget = { kind: 'new'; date: DateString; moodId: number | null } | { kind: 'edit'; id: number };

export interface EntryEditor {
  /** Null when the entry to edit no longer exists. */
  draft: EntryDraft | null;
  isNew: boolean;
  /** Day of the entry as saved, null for a new one. */
  savedDate: DateString | null;
  /** Something changed since the editor opened; closing now would lose it. */
  dirty: boolean;
  /** A mood is picked. The day may hold other entries already. */
  canSave: boolean;
  /** The turning point that goes when this entry is deleted, or saved on another day, since it is the last of its day. */
  turningPointLostOnDelete: TurningPoint | undefined;
  turningPointLostOnSave: TurningPoint | undefined;
  /** The experiments asking "kept today?" on the draft's day, with the answer shown. */
  checkIns: CheckInRow[];
  /** Ja or Nein tapped; the same answer again takes it back. A "no" is confirmed by the screen first. */
  tapCheckIn: (experimentId: number, kept: boolean) => void;
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
  // `reminder_time` is the latest of the daily reminder's times.
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
  // Set once the draft is written or the entry deleted: a second tap before the editor has closed
  // must not write again.
  const done = useRef(false);
  const turningPointLostOnDelete = useQuery(() => (id !== null ? turningPointLostBy(getDb(), id) : undefined), [id]);
  const turningPointLostOnSave = useQuery(() => (id !== null && moved ? turningPointLostBy(getDb(), id, date ?? undefined) : undefined), [id, date, moved]);
  // The answers belong to the day; the ones stored for it prefill a second entry of the day.
  const now = useToday();
  const experiments = useExperiments();
  const stored = useExperimentAnswers(date ?? now);
  const asking = date ? askingOn(experiments, date, now) : [];
  const checkIns: CheckInRow[] = draft
    ? asking.map((experiment) => {
        const answer = checkInAnswer(draft.check_ins, stored, experiment.id);
        const pending = draft.check_ins[experiment.id] === false;
        return { experiment, answer, endsOn: pending ? endDateAfterNo(experiment, draft.date) : null };
      })
    : [];

  return {
    draft,
    isNew: id === null,
    savedDate: id === null ? null : (initial?.date ?? null),
    dirty: draft !== null && initial !== null && !sameDraft(draft, initial),
    canSave: input !== null,
    turningPointLostOnDelete,
    turningPointLostOnSave,
    checkIns,
    tapCheckIn: (experimentId, kept) =>
      setDraft((current) => (current ? { ...current, check_ins: tapCheckIn(current.check_ins, stored, experimentId, kept) } : current)),
    // Another day drops the changed answers: they were given for the day before.
    update: (patch) =>
      setDraft((current) => (current ? { ...current, ...patch, ...(patch.date !== undefined && patch.date !== current.date ? { check_ins: {} } : {}) } : current)),
    save: () => {
      if (done.current || !input || !draft) return false;
      // Only for experiments that still ask on this day; a "no" ends its experiment here.
      const answers = Object.fromEntries(asking.filter((experiment) => experiment.id in draft.check_ins).map((experiment) => [experiment.id, draft.check_ins[experiment.id] ?? null]));
      const celebration = celebrateSave(() =>
        mutate(() => {
          const entry = saveEntry(getDb(), id, input);
          if (Object.keys(answers).length > 0) setExperimentDays(getDb(), input.date, answers, now);
          return entry;
        }),
      );
      noteSaveForReview();
      done.current = true;
      removePhotoFiles((initial?.photos ?? []).filter((name) => !input.photos?.includes(name)));
      // A celebration brings its own buzz when it shows; one is enough.
      if (!celebration) haptics.confirm();
      return true;
    },
    remove: () => {
      if (id === null || done.current) return;
      done.current = true;
      removePhotoFiles(mutate(() => deleteEntry(getDb(), id)));
    },
  };
}
