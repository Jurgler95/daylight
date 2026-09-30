import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MoodBadge } from '@/components/mood/MoodBadge';
import { AppText, Chip, PressableScale, Segmented } from '@/components/ui';
import { MOOD_LEVELS, type MoodLevel } from '@/db/schema';
import { levelMood, type Catalog } from '@/lib/catalog/catalog';
import { toggleId } from '@/lib/entry/draft';
import { haptics } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { PERIODS, type SearchQuery } from '@/lib/search/search';
import { TOUCH_TARGET, spacing } from '@/lib/theme';

interface Props {
  query: SearchQuery;
  catalog: Catalog;
  chipIds: readonly number[];
  onChange: (query: SearchQuery) => void;
}

/** Mood levels (any of), period, and the most used activities (all of). */
export function FilterPanel({ query, catalog, chipIds, onChange }: Props) {
  const { t } = useTranslation();
  const levels = [...MOOD_LEVELS].reverse();
  return (
    <View style={styles.root}>
      <View style={styles.levels}>
        {levels.map((level) => {
          const mood = levelMood(catalog, level);
          const on = query.levels.includes(level);
          return (
            <PressableScale
              key={level}
              pressedScale={0.9}
              onPress={() => {
                if (on) haptics.off();
                else haptics.on();
                onChange({ ...query, levels: toggleId(query.levels, level) as MoodLevel[] });
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={mood.label}
              style={styles.level}
            >
              <MoodBadge level={level} icon={mood.icon} size={36} filled={on} />
            </PressableScale>
          );
        })}
      </View>
      <Segmented
        options={PERIODS.map((period) => ({ value: period, label: t(`history.period.${period}`) }))}
        value={query.period}
        onChange={(period) => onChange({ ...query, period })}
      />
      {chipIds.length > 0 ? (
        <>
          <AppText variant="caption" muted>
            {t('history.activitiesAll')}
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {chipIds.map((id) => {
              const activity = catalog.activityById.get(id);
              if (!activity) return null;
              return (
                <Chip
                  key={id}
                  label={activity.name}
                  icon={activity.icon as IconName}
                  selected={query.activityIds.includes(id)}
                  onPress={() => onChange({ ...query, activityIds: toggleId(query.activityIds, id) })}
                />
              );
            })}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  levels: { flexDirection: 'row', justifyContent: 'space-between' },
  level: { minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
});
