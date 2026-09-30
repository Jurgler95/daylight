import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';

import { DEFAULT_MOODS, knownActivitiesByGroup } from '@/lib/daylio/known';

import { FALLBACK_ACTIVITY_ICON } from '..';
import { ICON_SECTIONS } from '../catalog';

const all = ICON_SECTIONS.flatMap((section) => section.icons);

describe('icon catalog', () => {
  it('only offers glyphs the font has', () => {
    const missing = all.filter((icon) => !(icon in glyphMap));
    expect(missing).toEqual([]);
  });

  it('offers every icon the import and the defaults assign', () => {
    const assigned = [...DEFAULT_MOODS.map((mood) => mood.icon), ...knownActivitiesByGroup().map((activity) => activity.icon), FALLBACK_ACTIVITY_ICON];
    expect(assigned.filter((icon) => !all.includes(icon))).toEqual([]);
  });

  it('lists each icon once', () => {
    expect(new Set(all).size).toBe(all.length);
  });
});
