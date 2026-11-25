import { createContext, useContext, type PropsWithChildren } from 'react';

import { useToday } from '@/lib/dates/useToday';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { useTheme } from '@/lib/theme';

import { appearanceOf, type Appearance } from './appearance';
import { activeDesign } from './calendar';
import type { DesignKey } from './designs';

const DesignContext = createContext<DesignKey | null>(null);

/** Today's design after the two switches under "Mehr", null for the plain daylight look. Moves on at midnight. */
export function useActiveDesign(): DesignKey | null {
  const seasons = useSettingsStore((s) => s.settings?.design_seasons ?? true);
  const festivals = useSettingsStore((s) => s.settings?.design_festivals ?? true);
  const today = useToday();
  return activeDesign(today, { seasons, festivals });
}

/**
 * Works out today's design once for everything below it (root layout), so the screens do not each
 * keep their own clock. Without it, as on the error screen before the settings load, the plain look.
 */
export function DesignProvider({ children }: PropsWithChildren) {
  return <DesignContext.Provider value={useActiveDesign()}>{children}</DesignContext.Provider>;
}

/** The design from `DesignProvider`, null for the plain daylight look. */
export function useDesign(): DesignKey | null {
  return useContext(DesignContext);
}

/** Glow, backdrop and strewn motifs of today's design in the scheme on screen, null for the plain daylight look. */
export function useAppearance(): Appearance | null {
  const key = useDesign();
  const { scheme } = useTheme();
  return key ? appearanceOf(key, scheme) : null;
}
