import type { MoodLevel } from '@/db/schema';
import { currentLanguage, type Language } from '@/lib/i18n/language';
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

/** Created on first start, best first like in Daylio, but with Daylight's own names. */
const MOODS_BY_LANGUAGE: Record<Language, readonly DefaultMood[]> = {
  de: [
    { label: 'Super', level: 5, icon: 'emoticon-excited-outline' },
    { label: 'Gut', level: 4, icon: 'emoticon-happy-outline' },
    { label: 'Ok', level: 3, icon: 'emoticon-neutral-outline' },
    { label: 'Schlecht', level: 2, icon: 'emoticon-sad-outline' },
    { label: 'Mies', level: 1, icon: 'emoticon-cry-outline' },
  ],
  en: [
    { label: 'Great', level: 5, icon: 'emoticon-excited-outline' },
    { label: 'Good', level: 4, icon: 'emoticon-happy-outline' },
    { label: 'Okay', level: 3, icon: 'emoticon-neutral-outline' },
    { label: 'Bad', level: 2, icon: 'emoticon-sad-outline' },
    { label: 'Awful', level: 1, icon: 'emoticon-cry-outline' },
  ],
};

export function defaultMoods(language: Language = currentLanguage()): readonly DefaultMood[] {
  return MOODS_BY_LANGUAGE[language];
}

/** The German set; icons and levels are the same in every language. */
export const DEFAULT_MOODS = MOODS_BY_LANGUAGE.de;

export function moodIconForLevel(level: MoodLevel): IconName {
  return DEFAULT_MOODS.find((mood) => mood.level === level)?.icon ?? 'emoticon-neutral-outline';
}

const MOOD_NAMES: Record<MoodLevel, readonly string[]> = {
  5: ['Super', 'rad', 'great', 'Großartig', 'Fantastisch'],
  4: ['Gut', 'good'],
  3: ['Ok', 'okay', 'meh', 'Naja'],
  2: ['Schlecht', 'bad'],
  1: ['Mies', 'Lausig', 'awful', 'Schrecklich', 'Furchtbar'],
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

/**
 * The standard groups, created on first start in the app's language, plus the one that takes
 * activities outside the known list. A group is found by its name in either language, so an
 * English Daylio export lands in "Gefühle" as well as in "Emotions".
 */
export type GroupKey = 'feelings' | 'sleep' | 'weather' | 'social' | 'work' | 'leisure' | 'imported';

const GROUP_NAMES: Record<GroupKey, Record<Language, string>> = {
  feelings: { de: 'Gefühle', en: 'Emotions' },
  sleep: { de: 'Schlaf', en: 'Sleep' },
  weather: { de: 'Wetter', en: 'Weather' },
  social: { de: 'Soziales', en: 'Social' },
  work: { de: 'Arbeit', en: 'Work' },
  leisure: { de: 'Orte und Freizeit', en: 'Places and hobbies' },
  imported: { de: 'Importiert', en: 'Imported' },
};

const DEFAULT_GROUP_KEYS = ['feelings', 'sleep', 'weather', 'social', 'work', 'leisure'] as const;
type DefaultGroupKey = (typeof DEFAULT_GROUP_KEYS)[number];

export function groupName(key: GroupKey, language: Language = currentLanguage()): string {
  return GROUP_NAMES[key][language];
}

/** Created on first start, in order. */
export function defaultGroups(language: Language = currentLanguage()): string[] {
  return DEFAULT_GROUP_KEYS.map((key) => groupName(key, language));
}

/** The German set, as the tests and the sample data know it. */
export const DEFAULT_GROUPS = defaultGroups('de');

/** The name of `key` among `existing` in either language, else its name in the app's language. */
export function resolveGroupName(key: GroupKey, existing: readonly string[], language: Language = currentLanguage()): string {
  const names = new Set(Object.values(GROUP_NAMES[key]).map(fold));
  return existing.find((name) => names.has(fold(name))) ?? groupName(key, language);
}

export interface KnownActivity {
  group: DefaultGroupKey;
  icon: IconName;
}

/** [names in any language, icon] per group. The first name is the German one, the second the English one. */
const ACTIVITIES: Record<DefaultGroupKey, readonly (readonly [readonly string[], IconName])[]> = {
  feelings: [
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
  sleep: [
    [['Gut', 'good sleep'], 'sleep'],
    [['Mäßig', 'medium sleep'], 'bed-outline'],
    [['Schlecht', 'bad sleep'], 'sleep-off'],
  ],
  weather: [
    [['Sonnig', 'sunny'], 'weather-sunny'],
    [['Wolkig', 'cloudy'], 'weather-cloudy'],
    [['Regnerisch', 'rainy'], 'weather-rainy'],
    [['Wind', 'windy'], 'weather-windy'],
    [['Hitze', 'heat'], 'thermometer-high'],
    [['Schnee', 'snow'], 'weather-snowy'],
    [['Sturm', 'storm'], 'weather-lightning'],
  ],
  social: [
    [['Familie', 'family'], 'human-male-female-child'],
    [['Freunde', 'friends'], 'account-multiple'],
    [['Besuche', 'Besuch'], 'account-group-outline'],
    [['Date', 'date'], 'heart-outline'],
    [['Party', 'party'], 'party-popper'],
  ],
  work: [
    [['Arbeit', 'work'], 'briefcase-outline'],
    [['Planmäßig beenden'], 'check-circle-outline'],
    [['Überstunden', 'overtime'], 'clock-alert-outline'],
    [['HomeOffice', 'Home Office', 'work from home'], 'laptop'],
    [['Teambuilding'], 'account-group'],
    [['Urlaub', 'vacation', 'holiday'], 'beach'],
    [['Krankheitstag', 'sick day'], 'hospital-box-outline'],
  ],
  leisure: [
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
for (const group of DEFAULT_GROUP_KEYS) {
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

/** Every known activity once, with its German name and group. The sample data draws from this. */
export function knownActivitiesByGroup(): { group: string; name: string; icon: IconName }[] {
  return DEFAULT_GROUP_KEYS.flatMap((group) => ACTIVITIES[group].map(([names, icon]) => ({ group: groupName(group, 'de'), name: names[0] ?? '', icon })));
}
