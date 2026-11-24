import { useCallback } from 'react';
import { Linking } from 'react-native';
import { create } from 'zustand';

import { readInsightEntries } from '@/lib/insights/useInsights';
import { useOverlayStore } from '@/lib/store/overlays';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { openPlayStore, reviewPromptDue } from './prompt';

/** Raised by a save that found the rating due; lives only until the app closes, so a start never brings the card. */
const useReviewStore = create<{ asked: boolean }>(() => ({ asked: false }));

/**
 * Called after every save in the entry editor, the only place the card comes from. `mutate` has
 * bumped the data version by then, so the entries are read fresh.
 */
export function noteSaveForReview(): void {
  const done = useSettingsStore.getState().settings?.review_prompt_done ?? false;
  if (reviewPromptDue({ createdAt: readInsightEntries().map((entry) => entry.created_at), done })) useReviewStore.setState({ asked: true });
}

/**
 * Opens Daylight in the Play Store, from the card or from "Mehr". Counts as an answer to the card,
 * so someone who rated from "Mehr" is not asked again.
 */
export function useRateApp(): () => void {
  const update = useSettingsStore((s) => s.update);
  return useCallback(() => {
    update({ review_prompt_done: true });
    useReviewStore.setState({ asked: false });
    void openPlayStore((url) => Linking.openURL(url));
  }, [update]);
}

/**
 * Whether "Heute" shows the card, and its two answers. It waits while a celebration, the star
 * message or the start sheet is up, so nothing stacks. Either answer puts it away for good.
 */
export function useReviewPrompt(): { show: boolean; rate: () => void; dismiss: () => void } {
  const asked = useReviewStore((s) => s.asked);
  const done = useSettingsStore((s) => s.settings?.review_prompt_done ?? false);
  const busy = useOverlayStore((s) => s.waiting.length > 0 || s.celebration !== null);
  const update = useSettingsStore((s) => s.update);
  const rate = useRateApp();
  const dismiss = useCallback(() => {
    update({ review_prompt_done: true });
    useReviewStore.setState({ asked: false });
  }, [update]);
  return { show: asked && !done && !busy, rate, dismiss };
}

/** For tests: forget a raised card. */
export function resetReviewPrompt(): void {
  useReviewStore.setState({ asked: false });
}
