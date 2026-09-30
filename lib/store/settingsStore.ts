import { create } from 'zustand';

import { getDb, type Settings } from '@/db';
import { getSettings, updateSettings, type SettingsPatch } from '@/db/repositories/settings';

interface SettingsState {
  settings: Settings | null;
  load: () => void;
  update: (patch: SettingsPatch) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  load: () => set({ settings: getSettings(getDb()) }),
  update: (patch) => set({ settings: updateSettings(getDb(), patch) }),
}));
