import { useTranslation } from 'react-i18next';

import { AppText, Card, SelectRow } from '@/components/ui';
import { MOOD_LEVELS, type MoodLevel } from '@/db/schema';
import { levelMood } from '@/lib/catalog/catalog';
import { useCatalog } from '@/lib/catalog/useCatalog';
import type { PlannedActivity, PlannedMood } from '@/lib/daylio/plan';

interface MoodProps {
  moods: readonly PlannedMood[];
  onChange: (key: string, level: MoodLevel) => void;
}

/** New mood names from the file, each hung on a level. */
export function MoodMapping({ moods, onChange }: MoodProps) {
  const { t } = useTranslation();
  const catalog = useCatalog();
  if (moods.length === 0) return null;
  // Named after the moods as they are now, so a renamed "Gut" shows its new name.
  const options = [...MOOD_LEVELS].reverse().map((level) => ({
    value: String(level),
    label: t('import.level', { name: levelMood(catalog, level).label, level }),
  }));
  return (
    <Card>
      <AppText variant="caption" muted>
        {t('import.newMoods').toUpperCase()}
      </AppText>
      {moods.map((mood) => (
        <SelectRow
          key={mood.key}
          label={mood.label}
          value={String(mood.level)}
          sections={[{ options }]}
          closeLabel={t('common.close')}
          onChange={(value) => onChange(mood.key, Number(value) as MoodLevel)}
        />
      ))}
    </Card>
  );
}

interface ActivityProps {
  activities: readonly PlannedActivity[];
  groups: readonly string[];
  onChange: (key: string, group: string) => void;
}

/** New activities from the file with the suggested group, changeable one by one. */
export function ActivityMapping({ activities, groups, onChange }: ActivityProps) {
  const { t } = useTranslation();
  if (activities.length === 0) return null;
  const options = groups.map((group) => ({ value: group, label: group }));
  return (
    <Card>
      <AppText variant="caption" muted>
        {t('import.newActivities').toUpperCase()}
      </AppText>
      {activities.map((activity) => (
        <SelectRow
          key={activity.key}
          label={activity.name}
          value={activity.group}
          sections={[{ options }]}
          closeLabel={t('common.close')}
          onChange={(group) => onChange(activity.key, group)}
        />
      ))}
    </Card>
  );
}
