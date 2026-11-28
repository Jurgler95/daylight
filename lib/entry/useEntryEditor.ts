import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getDb } from '@/db';
import { deleteEntry, getEntryDetails, saveEntry, turningPointLostBy } from '@/db/repositories/entries';
import { setExperimentDays } from '@/db/repositories/experiments';
import type { Experiment, TurningPoint } from '@/db/schema';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { nowTime, today, type DateString } from '@/lib/dates';
import { useToday } from '@/lib/dates/useToday';
import { askingOn, endOnDayBefore } from '@/lib/experiments/rules';
import { useExperimentAnswers, useExperiments } from '@/lib/experiments/useExperiments';
import { haptics } from '@/lib/haptics';
import { filePhotoStore } from '@/lib/photos/fileStore';
import { noteSaveForReview } from '@/lib/review/useReviewPrompt';
import { mutate, useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { celebrateSave } from '@/lib/streak/celebrate';

import { checkInAnswer, defaultTime, draftFromEntry, draftToInput, newDraft, sameDraft, tapCheckIn, type EntryDraft } from './draft';
import { fileDraftStorage } from './draftFile';
import { debounce, DRAFT_SAVE_DELAY_MS, draftKey, editorOpened, readSavedDraft, removeSavedDraft, restorableDraft, writeSavedDraft } from './savedDrafts';

/** "Kept today?" for one experiment that asks on the draft's day. */
export interface CheckInRow {
  experiment: Experiment;
  answer: boolean | null;
  /** Set while a "no" waits for "Speichern": the day the experiment will then end on. */
  endsOn: DateString | null;
}

/** `resume` opens the editor on its saved draft right away, without asking (the offer on start asked already). */
export type EditorTarget = { kind: 'new'; date: DateString; moodId: number | null; resume?: boolean } | { kind: 'edit'; id: number; resume?: boolean };

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
  /**
   * A draft of this editor survived the app being ended and waits for "Fortsetzen" or "Verwerfen".
   * Until one is picked nothing is written, so the old draft is not overwritten by an empty one.
   */
  savedDraft: boolean;
  resumeSaved: () => void;
  discardSaved: () => void;
  /** Leaving without saving ("Verwerfen"): the saved draft goes too. */
  discard: () => void;
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
 * The editor keeps its own draft and writes the entry only on "Speichern". The text fields are
 * controlled, so the draft always holds every keystroke; closing with changes asks first (see the
 * screen). Shortly after every change, and when the app goes to the background, the draft is also
 * kept on the device (`savedDrafts.ts`), so Android ending the app does not lose it.
 */
export function useEntryEditor(target: EditorTarget): EntryEditor {
  // `reminder_time` is the latest of the daily reminder's times.
  const reminderTime = useSettingsStore((s) => s.settings?.reminder_time ?? '20:30');
  const [initial] = useState<EntryDraft | null>(() => {
    if (target.kind === 'new') return newDraft(target.date, defaultTime(target.date, today(), nowTime(), reminderTime), target.moodId);
    const entry = getEntryDetails(getDb(), target.id);
    return entry ? draftFromEntry(entry) : null;
  });
  const key = draftKey(target.kind === 'new' ? { kind: 'new', date: target.date } : { kind: 'edit', id: target.id });
  const catalog = useCatalog();
  // Read once on opening, like `initial`.
  const [restorable] = useState<EntryDraft | null>(() => {
    if (!initial) return null;
    const fit = {
      hasMood: (moodId: number) => catalog.moodById.has(moodId),
      hasActivity: (activityId: number) => catalog.activityById.has(activityId),
      hasScale: (scaleId: number) => catalog.scaleById.has(scaleId),
      hasPhoto: (name: string) => {
        try {
          return filePhotoStore.has(name);
        } catch {
          return false;
        }
      },
    };
    return restorableDraft(readSavedDraft(fileDraftStorage, key), target, initial, fit);
  });
  const [draft, setDraft] = useState<EntryDraft | null>(target.resume && restorable ? restorable : initial);
  const [offer, setOffer] = useState<EntryDraft | null>(target.resume ? null : restorable);
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
  const dirty = draft !== null && initial !== null && !sameDraft(draft, initial);

  // Kept on the device a moment after the last change; written at once when the app leaves the front.
  const latest = useRef(draft);
  latest.current = draft;
  const saver = useMemo(
    () => debounce(() => latest.current && initial && writeSavedDraft(fileDraftStorage, key, latest.current, initial), DRAFT_SAVE_DELAY_MS),
    [key, initial],
  );
  useEffect(() => {
    if (offer !== null || done.current) return;
    if (dirty) saver.schedule();
    else {
      // Back to how it opened: nothing worth keeping.
      saver.cancel();
      removeSavedDraft(fileDraftStorage, key);
    }
  }, [draft, dirty, offer, saver, key]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') saver.flush();
    });
    const closed = editorOpened();
    return () => {
      subscription.remove();
      closed();
      saver.cancel();
    };
  }, [saver]);
  /** Leaving on purpose: the draft has no reason to come back. */
  const forget = () => {
    saver.cancel();
    removeSavedDraft(fileDraftStorage, key);
  };

  const checkIns: CheckInRow[] = draft
    ? asking.map((experiment) => {
        const answer = checkInAnswer(draft.check_ins, stored, experiment.id);
        const pending = draft.check_ins[experiment.id] === false;
        return { experiment, answer, endsOn: pending ? endOnDayBefore(experiment, draft.date) : null };
      })
    : [];

  return {
    draft,
    isNew: id === null,
    savedDate: id === null ? null : (initial?.date ?? null),
    dirty,
    canSave: input !== null,
    turningPointLostOnDelete,
    turningPointLostOnSave,
    checkIns,
    tapCheckIn: (experimentId, kept) =>
      setDraft((current) => (current ? { ...current, check_ins: tapCheckIn(current.check_ins, stored, experimentId, kept) } : current)),
    // Another day drops the changed answers: they were given for the day before.
    update: (patch) =>
      setDraft((current) => (current ? { ...current, ...patch, ...(patch.date !== undefined && patch.date !== current.date ? { check_ins: {} } : {}) } : current)),
    savedDraft: offer !== null,
    resumeSaved: () => {
      if (offer) setDraft(offer);
      setOffer(null);
    },
    discardSaved: () => {
      removeSavedDraft(fileDraftStorage, key);
      setOffer(null);
    },
    discard: forget,
    save: () => {
      if (done.current || !input || !draft) return false;
      // Only for experiments that still ask on this day; a "no" ends its experiment here.
      const answers = Object.fromEntries(asking.filter((experiment) => experiment.id in draft.check_ins).map((experiment) => [experiment.id, draft.check_ins[experiment.id] ?? null]));
      const celebration = celebrateSave(() =>
        // One transaction: when the answers fail, the entry is not saved either.
        mutate(() =>
          getDb().transaction((tx) => {
            const entry = saveEntry(tx, id, input);
            if (Object.keys(answers).length > 0) setExperimentDays(tx, input.date, answers, now);
            return entry;
          }),
        ),
      );
      noteSaveForReview();
      done.current = true;
      forget();
      removePhotoFiles((initial?.photos ?? []).filter((name) => !input.photos?.includes(name)));
      // A celebration brings its own buzz when it shows; one is enough.
      if (!celebration) haptics.confirm();
      return true;
    },
    remove: () => {
      if (id === null || done.current) return;
      done.current = true;
      forget();
      removePhotoFiles(mutate(() => deleteEntry(getDb(), id)));
    },
  };
}
