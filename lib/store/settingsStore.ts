import { create } from 'zustand';

import { getDb, type Settings } from '@/db';
import { getSettings, updateSettings, type SettingsPatch } from '@/db/repositories/settings';
import { tidyStandards } from '@/db/repositories/standards';
import { applyLanguage } from '@/lib/i18n';
import { deviceLanguage } from '@/lib/i18n/language';
import { useDataVersion } from '@/lib/store/dataVersion';

interface SettingsState {
  settings: Settings | null;
  load: () => void;
  update: (patch: SettingsPatch) => void;
}

/**
 * Every settings change passes through here, so the language follows the row. A switch renames the
 * standard moods, groups and activities and bumps the data version: memoised texts, dates and
 * numbers are computed again in the new language.
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
    const language = settings.language ?? deviceLanguage();
    if (language === previous) return;
    // The moods, groups and activities the app brought follow the language; renamed ones stay.
    getDb().transaction((tx) => tidyStandards(tx, language));
    useDataVersion.getState().bump();
  },
}));
