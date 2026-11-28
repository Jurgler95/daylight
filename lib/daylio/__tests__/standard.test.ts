import type { DateString } from '@/lib/dates';
import { LANGUAGES } from '@/lib/i18n/language';

import { buildImportPlan, entryKey, type Catalog } from '../plan';

import {
  activityIdentity,
  activityName,
  defaultGroups,
  defaultMoods,
  groupName,
  isStandardMood,
  knownActivitiesByGroup,
  standardActivityKey,
  standardGroupKey,
  standardMoodLabel,
  starterActivities,
} from '../known';

const GROUP_KEYS = ['feelings', 'sleep', 'weather', 'social', 'work', 'leisure'] as const;

describe('standard names', () => {
  it('knows every mood of every language at its own level only', () => {
    for (const language of LANGUAGES) {
      for (const mood of defaultMoods(language)) {
        expect(isStandardMood(mood.label, mood.level)).toBe(true);
        expect(standardMoodLabel(mood.level, language)).toBe(mood.label);
        for (const other of [1, 2, 3, 4, 5].filter((level) => level !== mood.level)) {
          expect(isStandardMood(mood.label, other)).toBe(false);
        }
      }
    }
    expect(isStandardMood('great', 5)).toBe(true);
    expect(isStandardMood('Sehr gut', 5)).toBe(false);
    // Import aliases are not the app's own names.
    expect(isStandardMood('rad', 5)).toBe(false);
  });

  it('finds each group under its name in every language', () => {
    for (const language of LANGUAGES) {
      defaultGroups(language).forEach((name, index) => expect(standardGroupKey(name)).toBe(GROUP_KEYS[index]));
      expect(standardGroupKey(groupName('imported', language))).toBe('imported');
    }
    expect(standardGroupKey('Hobbys')).toBeNull();
  });

  it('finds each starter activity in its own group in every language, never in another', () => {
    const german = starterActivities('de');
    for (const language of LANGUAGES) {
      starterActivities(language).forEach((starters, group) => {
        starters.forEach((activity, index) => {
          const key = german[group]![index]!.name;
          expect(standardActivityKey(activity.name, GROUP_KEYS[group]!)).toBe(key);
          expect(activityName(key as never, language)).toBe(activity.name);
        });
      });
    }
    expect(standardActivityKey('Gut', 'sleep')).toBe('Gut');
    expect(standardActivityKey('Good sleep', 'sleep')).toBe('Gut');
    expect(standardActivityKey('Gut', 'feelings')).toBeNull();
    expect(standardActivityKey('Gut', null)).toBeNull();
    expect(standardActivityKey('Yoga', 'leisure')).toBeNull();
  });

  it('has no two activities of one group sharing a name in any language', () => {
    for (const activity of knownActivitiesByGroup()) {
      for (const language of LANGUAGES) {
        expect([language, standardActivityKey(activityName(activity.name as never, language), standardGroupKey(activity.group))]).toEqual([language, activity.name]);
      }
    }
  });

  it('lets a CSV find a standard activity that now carries its name in the app language', () => {
    const catalog: Catalog = {
      moods: [{ id: 1, label: 'Gut', level: 4, sort_order: 0, archived: false }],
      groups: [{ id: 1, name: 'Gefühle' }],
      activities: [{ id: 7, group_id: 1, name: 'Glücklich' }],
      scales: [],
      entryKeys: new Map([[entryKey({ date: '2026-03-01', time: '20:00', level: 4, noteTitle: null, note: null, activities: ['Glücklich'] }), 1]]),
      photoNames: new Set(),
    };
    const record = { line: 2, date: '2026-03-01' as DateString, time: '20:00', mood: 'good', activities: ['happy'], scales: [], noteTitle: null, note: null, photos: [] };
    const plan = buildImportPlan([record], catalog);
    expect(plan.activities.map((activity) => activity.existingId)).toEqual([7]);
    expect(plan.duplicates).toBe(1);
  });

  it('tells entries apart by the slot of a standard activity, not by its language', () => {
    expect(activityIdentity('Happy')).toBe(activityIdentity('Glücklich'));
    expect(activityIdentity('happy')).toBe(activityIdentity('Alegría'));
    expect(activityIdentity('Yoga')).toBe('yoga');
    expect(activityIdentity('Happy')).not.toBe(activityIdentity('Traurig'));
  });
});
