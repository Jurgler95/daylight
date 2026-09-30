import type { MoodLevel } from '@/db/schema';
import type { IconName } from '@/lib/icons';
import { fold } from '@/lib/search/fold';

/**
 * Fixed vocabulary of Daylio's standard names (German and English), used to suggest a level for a
 * mood and a group and icon for an activity during import. A suggestion, never a rule: the import
 * preview lets every one of them be changed.
 */

export interface DefaultMood {
  label: string;
  level: MoodLevel;
  icon: IconName;
}

/** Created on first start, best first like in Daylio. */
export const DEFAULT_MOODS: readonly DefaultMood[] = [
  { label: 'Super', level: 5, icon: 'emoticon-excited-outline' },
  { label: 'Gut', level: 4, icon: 'emoticon-happy-outline' },
  { label: 'Ok', level: 3, icon: 'emoticon-neutral-outline' },
  { label: 'Schlecht', level: 2, icon: 'emoticon-sad-outline' },
  { label: 'Lausig', level: 1, icon: 'emoticon-cry-outline' },
];

export function moodIconForLevel(level: MoodLevel): IconName {
  return DEFAULT_MOODS.find((mood) => mood.level === level)?.icon ?? 'emoticon-neutral-outline';
}

const MOOD_NAMES: Record<MoodLevel, readonly string[]> = {
  5: ['Super', 'rad', 'Großartig', 'Fantastisch'],
  4: ['Gut', 'good'],
  3: ['Ok', 'okay', 'meh', 'Naja'],
  2: ['Schlecht', 'bad'],
  1: ['Lausig', 'awful', 'Schrecklich', 'Furchtbar'],
};

const MOOD_LEVEL_BY_NAME = new Map<string, MoodLevel>(
  (Object.entries(MOOD_NAMES) as unknown as [string, readonly string[]][]).flatMap(([level, names]) =>
    names.map((name) => [fold(name), Number(level) as MoodLevel] as const),
  ),
);

/** Level of a standard Daylio mood name in either language, or null for a custom mood. */
export function knownMoodLevel(name: string): MoodLevel | null {
  return MOOD_LEVEL_BY_NAME.get(fold(name.trim())) ?? null;
}

/** Created on first start. Activities outside the known list land in `IMPORTED_GROUP`. */
export const DEFAULT_GROUPS = ['Gefühle', 'Schlaf', 'Wetter', 'Soziales', 'Arbeit', 'Orte und Freizeit'] as const;
export const IMPORTED_GROUP = 'Importiert';

type GroupName = (typeof DEFAULT_GROUPS)[number];

export interface KnownActivity {
  group: GroupName;
  icon: IconName;
}

/** [names in any language, icon] per group. The first name is the German one. */
const ACTIVITIES: Record<GroupName, readonly (readonly [readonly string[], IconName])[]> = {
  Gefühle: [
    [['Glücklich', 'happy'], 'emoticon-happy-outline'],
    [['Aufgeregt', 'excited'], 'flash-outline'],
    [['Dankbar', 'grateful'], 'hand-heart-outline'],
    [['Entspannt', 'relaxed'], 'spa-outline'],
    [['Zufrieden', 'content'], 'emoticon-outline'],
    [['Müde', 'tired'], 'power-sleep'],
    [['Unsicher', 'unsure'], 'emoticon-confused-outline'],
    [['Gelangweilt', 'bored'], 'emoticon-neutral-outline'],
    [['Angespannt', 'anxious'], 'alert-outline'],
    [['Wütend', 'angry'], 'emoticon-angry-outline'],
    [['Gestresst', 'stressed'], 'lightning-bolt-outline'],
    [['Traurig', 'sad'], 'emoticon-sad-outline'],
    [['Verzweifelt', 'desperate'], 'emoticon-cry-outline'],
    [['Krank', 'sick'], 'emoticon-sick-outline'],
  ],
  Schlaf: [
    [['Gut', 'good sleep'], 'sleep'],
    [['Mäßig', 'medium sleep'], 'bed-outline'],
    [['Schlecht', 'bad sleep'], 'sleep-off'],
  ],
  Wetter: [
    [['Sonnig', 'sunny'], 'weather-sunny'],
    [['Wolkig', 'cloudy'], 'weather-cloudy'],
    [['Regnerisch', 'rainy'], 'weather-rainy'],
    [['Wind', 'windy'], 'weather-windy'],
    [['Hitze', 'heat'], 'thermometer-high'],
    [['Schnee', 'snow'], 'weather-snowy'],
    [['Sturm', 'storm'], 'weather-lightning'],
  ],
  Soziales: [
    [['Familie', 'family'], 'human-male-female-child'],
    [['Freunde', 'friends'], 'account-multiple'],
    [['Besuche', 'Besuch'], 'account-group-outline'],
    [['Date', 'date'], 'heart-outline'],
    [['Party', 'party'], 'party-popper'],
  ],
  Arbeit: [
    [['Arbeit', 'work'], 'briefcase-outline'],
    [['Planmäßig beenden'], 'check-circle-outline'],
    [['Überstunden', 'overtime'], 'clock-alert-outline'],
    [['HomeOffice', 'Home Office', 'work from home'], 'laptop'],
    [['Teambuilding'], 'account-group'],
    [['Urlaub', 'vacation', 'holiday'], 'beach'],
    [['Krankheitstag', 'sick day'], 'hospital-box-outline'],
  ],
  'Orte und Freizeit': [
    [['zu Hause', 'home'], 'home-outline'],
    [['Einkaufen', 'shopping'], 'cart-outline'],
    [['Reisen', 'travel'], 'airplane'],
    [['Natur', 'nature'], 'pine-tree'],
    [['Filme', 'movies'], 'movie-open-outline'],
    [['Restaurant', 'restaurant'], 'silverware-fork-knife'],
    [['Entspannen', 'relax'], 'sofa-outline'],
    [['Lesen', 'read', 'reading'], 'book-open-variant'],
    [['Spielen', 'gaming'], 'gamepad-variant-outline'],
    [['Sport', 'sport', 'exercise'], 'run'],
  ],
};

const ACTIVITY_BY_NAME = new Map<string, KnownActivity>();
for (const group of DEFAULT_GROUPS) {
  for (const [names, icon] of ACTIVITIES[group]) {
    for (const name of names) {
      const key = fold(name);
      // "Gut" and "Schlecht" exist only as sleep here; first definition wins for any repeat.
      if (!ACTIVITY_BY_NAME.has(key)) ACTIVITY_BY_NAME.set(key, { group, icon });
    }
  }
}

/** Group and icon for a standard Daylio activity name, or null when it is unknown. */
export function knownActivity(name: string): KnownActivity | null {
  return ACTIVITY_BY_NAME.get(fold(name.trim())) ?? null;
}

/** Every known activity once, German name first. The sample data draws from this. */
export function knownActivitiesByGroup(): { group: GroupName; name: string; icon: IconName }[] {
  return DEFAULT_GROUPS.flatMap((group) => ACTIVITIES[group].map(([names, icon]) => ({ group, name: names[0] ?? '', icon })));
}
