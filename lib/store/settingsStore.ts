import { create } from 'zustand';

import { getDb, type Settings } from '@/db';
import { getSettings, updateSettings, type SettingsPatch } from '@/db/repositories/settings';
import { applyLanguage } from '@/lib/i18n';
import { deviceLanguage } from '@/lib/i18n/language';
import { useDataVersion } from '@/lib/store/dataVersion';

interface SettingsState {
  settings: Settings | null;
  load: () => void;
  update: (patch: SettingsPatch) => void;
}

/**
 * Every settings change passes through here, so the language follows the row. A switch bumps the
 * data version too: memoised texts, dates and numbers are computed again in the new language.
 */
function withLanguage(settings: Settings): Settings {
  applyLanguage(settings.language ?? deviceLanguage());
  return settings;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  load: () => set({ settings: withLanguage(getSettings(getDb())) }),
  update: (patch) => {
    const previous = get().settings?.language ?? deviceLanguage();
    const settings = withLanguage(updateSettings(getDb(), patch));
    set({ settings });
    if ((settings.language ?? deviceLanguage()) !== previous) useDataVersion.getState().bump();
  },
}));
