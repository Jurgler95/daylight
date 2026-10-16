import type { MoodLevel } from '@/db/schema';
import { CONTENT, type ActivityKey, type GroupKey } from '@/lib/i18n/content';
import { currentLanguage, LANGUAGES, type Language } from '@/lib/i18n/language';
import { FALLBACK_ACTIVITY_ICON, type IconName } from '@/lib/icons';
import { fold } from '@/lib/search/fold';

/**
 * Fixed vocabulary of Daylio's standard names (German and English) and of Daylight's own names in
 * every language of the app, used to suggest a level for a mood and a group and icon for an activity during import. A suggestion, never a rule: the import
 * preview lets every one of them be changed.
 */

export interface DefaultMood {
  label: string;
  level: MoodLevel;
  icon: IconName;
}

const MOOD_ICONS = ['emoticon-excited-outline', 'emoticon-happy-outline', 'emoticon-neutral-outline', 'emoticon-sad-outline', 'emoticon-cry-outline'] as const;

/** Five names best first, levels 5 to 1, with the icon of each level. */
function moodSet(names: readonly [string, string, string, string, string]): readonly DefaultMood[] {
  return names.map((label, index) => ({ label, level: (5 - index) as MoodLevel, icon: MOOD_ICONS[index]! }));
}

/** Created on first start, best first like in Daylio, but with Daylight's own names. */
const MOODS_BY_LANGUAGE: Record<Language, readonly DefaultMood[]> = {
  de: moodSet(['Super', 'Gut', 'Ok', 'Schlecht', 'Mies']),
  en: moodSet(['Great', 'Good', 'Okay', 'Bad', 'Awful']),
  es: moodSet(CONTENT.es.moods),
  pt: moodSet(CONTENT.pt.moods),
  fr: moodSet(CONTENT.fr.moods),
  it: moodSet(CONTENT.it.moods),
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

/**
 * Level of a standard mood name, or null for a custom mood. Daylio's names and the German and
 * English defaults count always, the defaults of the other languages only in their own language,
 * so a self-made "Normal" in an English export stays a mood of its own.
 */
export function knownMoodLevel(name: string, language: Language = currentLanguage()): MoodLevel | null {
  const key = fold(name.trim());
  return MOOD_LEVEL_BY_NAME.get(key) ?? MOODS_BY_LANGUAGE[language].find((mood) => fold(mood.label) === key)?.level ?? null;
}

/**
 * The standard groups, created on first start in the app's language, plus the one that takes
 * activities outside the known list. A group is found by its name in any language, so an
 * English Daylio export lands in "Gefühle" as well as in "Emotions".
 */
export type { GroupKey };

const GROUP_NAMES_DE_EN: Record<GroupKey, { de: string; en: string }> = {
  feelings: { de: 'Gefühle', en: 'Emotions' },
  sleep: { de: 'Schlaf', en: 'Sleep' },
  weather: { de: 'Wetter', en: 'Weather' },
  social: { de: 'Soziales', en: 'Social' },
  work: { de: 'Arbeit', en: 'Work' },
  leisure: { de: 'Orte und Freizeit', en: 'Places and hobbies' },
  imported: { de: 'Importiert', en: 'Imported' },
};

const GROUP_NAMES = Object.fromEntries(
  (Object.keys(GROUP_NAMES_DE_EN) as GroupKey[]).map((key) => [
    key,
    { ...GROUP_NAMES_DE_EN[key], es: CONTENT.es.groups[key], pt: CONTENT.pt.groups[key], fr: CONTENT.fr.groups[key], it: CONTENT.it.groups[key] },
  ]),
) as Record<GroupKey, Record<Language, string>>;

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

/** The name of `key` among `existing` in any language, else its name in the app's language. */
export function resolveGroupName(key: GroupKey, existing: readonly string[], language: Language = currentLanguage()): string {
  const names = new Set(Object.values(GROUP_NAMES[key]).map(fold));
  return existing.find((name) => names.has(fold(name))) ?? groupName(key, language);
}

export interface KnownActivity {
  group: DefaultGroupKey;
  icon: IconName;
}

/**
 * [Daylio names, icon] per group. The first name is the German one, the second the English one,
 * further ones are variants; the other languages come from `lib/i18n/content`, keyed by the German name.
 */
const ACTIVITIES: Record<DefaultGroupKey, readonly (readonly [readonly [ActivityKey, ...string[]], IconName])[]> = {
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
    [['Besuche', 'visits', 'Besuch'], 'account-group-outline'],
    [['Date', 'date'], 'heart-outline'],
    [['Party', 'party'], 'party-popper'],
  ],
  work: [
    [['Arbeit', 'work'], 'briefcase-outline'],
    [['Planmäßig beenden', 'left on time'], 'check-circle-outline'],
    [['Überstunden', 'overtime'], 'clock-alert-outline'],
    [['HomeOffice', 'work from home', 'Home Office'], 'laptop'],
    [['Teambuilding', 'team building'], 'account-group'],
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
    [['Lesen', 'reading', 'read'], 'book-open-variant'],
    [['Spielen', 'gaming'], 'gamepad-variant-outline'],
    [['Sport', 'sport', 'exercise'], 'run'],
  ],
};

const ACTIVITY_BY_NAME = new Map<string, KnownActivity>();
for (const group of DEFAULT_GROUP_KEYS) {
  for (const [names, icon] of ACTIVITIES[group]) {
    const german = names[0];
    const translated = Object.values(CONTENT).map((content) => content.activities[german]);
    for (const name of [...names, ...translated]) {
      const key = fold(name);
      // "Gut" and "Schlecht" exist only as sleep here; first definition wins for any repeat.
      if (!ACTIVITY_BY_NAME.has(key)) ACTIVITY_BY_NAME.set(key, { group, icon });
    }
  }
}

/**
 * Created on first start next to the groups, so a new journal is usable right away: a short pick
 * from Daylio's standard activities, fewer than Daylio itself brings. Listed by German name.
 */
const STARTER_ACTIVITIES: Record<DefaultGroupKey, readonly ActivityKey[]> = {
  feelings: ['Glücklich', 'Entspannt', 'Müde', 'Gestresst', 'Traurig'],
  sleep: ['Gut', 'Mäßig', 'Schlecht'],
  weather: ['Sonnig', 'Wolkig', 'Regnerisch', 'Schnee'],
  social: ['Familie', 'Freunde', 'Date', 'Party'],
  work: ['Arbeit', 'HomeOffice', 'Überstunden', 'Urlaub'],
  leisure: ['Sport', 'Lesen', 'Natur', 'Filme', 'Einkaufen'],
};

/** The starter activities of each default group, named in `language`, in the order of `defaultGroups`. */
export function starterActivities(language: Language = currentLanguage()): { name: string; icon: IconName }[][] {
  return DEFAULT_GROUP_KEYS.map((group) =>
    STARTER_ACTIVITIES[group].map((german) => {
      const [names, icon] = ACTIVITIES[group].find(([candidates]) => candidates[0] === german) ?? [[german], FALLBACK_ACTIVITY_ICON];
      if (language === 'de') return { name: german, icon };
      if (language !== 'en') return { name: CONTENT[language].activities[german], icon };
      const english = names[1] ?? german;
      return { name: english.charAt(0).toUpperCase() + english.slice(1), icon };
    }),
  );
}

/** Starter names per language, folded, so a renamed or self-made activity is told apart from one the app brought. */
const STARTER_NAMES = Object.fromEntries(
  LANGUAGES.map((language) => [language, new Set(starterActivities(language).flat().map((activity) => fold(activity.name)))]),
) as Record<Language, Set<string>>;

/**
 * Whether `name` is one of the activities the app sets up on first start, in German, English or
 * `language`. Not in every language: a self-made "Stress" in a German journal stays self-made.
 */
export function isStarterActivity(name: string, language: Language = currentLanguage()): boolean {
  const key = fold(name.trim());
  return STARTER_NAMES.de.has(key) || STARTER_NAMES.en.has(key) || STARTER_NAMES[language].has(key);
}

/** Group and icon for a standard Daylio activity name, or null when it is unknown. */
export function knownActivity(name: string): KnownActivity | null {
  return ACTIVITY_BY_NAME.get(fold(name.trim())) ?? null;
}

/** Every known activity once, with its German name and group. The sample data draws from this. */
export function knownActivitiesByGroup(): { group: string; name: string; icon: IconName }[] {
  return DEFAULT_GROUP_KEYS.flatMap((group) => ACTIVITIES[group].map(([names, icon]) => ({ group: groupName(group, 'de'), name: names[0] ?? '', icon })));
}
