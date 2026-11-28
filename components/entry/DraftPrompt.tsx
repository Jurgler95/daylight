import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { getDb } from '@/db';
import { getEntry } from '@/db/repositories/entries';
import { fileDraftStorage } from '@/lib/entry/draftFile';
import { draftRoute, draftTarget, editorsOpen, readSavedDrafts, removeSavedDraft } from '@/lib/entry/savedDrafts';
import { useLockStore } from '@/lib/lock/store';

/**
 * Time the navigator gets after start before the offer looks around: a reminder's link or a widget
 * opens its editor a moment later, and that editor offers its own draft instead.
 */
const SETTLE_MS = 800;

/**
 * Once per start, after unlocking: "Angefangenen Eintrag fortsetzen?" for the newest draft Android
 * ended the app over. "Fortsetzen" opens its editor on the draft, "Verwerfen" deletes it. The
 * question names no content, so nothing of the diary shows before the user decides. Other drafts
 * wait until their editor opens again, or until they are too old.
 */
export function DraftPrompt() {
  const { t } = useTranslation();
  const locked = useLockStore((s) => s.locked);
  const asked = useRef(false);

  useEffect(() => {
    if (locked || asked.current) return;
    const timer = setTimeout(() => {
      if (asked.current || useLockStore.getState().locked) return;
      asked.current = true;
      if (editorsOpen() > 0) return;
      const saved = readSavedDrafts(fileDraftStorage)[0];
      const target = saved ? draftTarget(saved.key) : null;
      if (!saved || !target) return;
      // The entry was deleted since: nothing left to continue.
      if (target.kind === 'edit' && !getEntry(getDb(), target.id)) {
        removeSavedDraft(fileDraftStorage, saved.key);
        return;
      }
      Alert.alert(
        t('entry.draftTitle'),
        t('entry.draftBody'),
        [
          { text: t('entry.discard'), style: 'destructive', onPress: () => removeSavedDraft(fileDraftStorage, saved.key) },
          { text: t('entry.draftContinue'), onPress: () => router.push(draftRoute(target)) },
        ],
        { cancelable: false },
      );
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [locked, t]);

  return null;
}
