import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { levelMood, type Catalog } from '@/lib/catalog/catalog';
import type { OutlookDay } from '@/lib/outlook';
import { moodColors, spacing, useTheme } from '@/lib/theme';

import { useOutlookTexts } from './useOutlookTexts';

/**
 * One future day on "Heute": the range with its reasons where the outlook is shown, otherwise the
 * weekday so far and the usual activities. Never a single value without its range.
 */
export function OutlookDayCard({ day, catalog }: { day: OutlookDay; catalog: Catalog }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const texts = useOutlookTexts(catalog);
  const range = day.range;
  return (
    <Card>
      <AppText variant="caption" muted>
        {t('settings.outlook').toUpperCase()}
      </AppText>
      {range ? (
        <>
          <View style={styles.row}>
            <MaterialCommunityIcons name={levelMood(catalog, range.mid).icon} size={28} color={moodColors[range.mid].strong} />
            <AppText variant="headline" style={styles.flex}>
              {texts.range(range)}
            </AppText>
          </View>
          {range.hardChance ? <AppText muted>{texts.hardChance(range.hardChance)}</AppText> : null}
          {range.reasons.length ? (
            <View style={styles.reasons}>
              {range.reasons.map((reason) => (
                <View key={`${reason.kind}:${'activityId' in reason ? reason.activityId : ''}`} style={styles.row}>
                  <AppText muted>{'•'}</AppText>
                  <AppText style={styles.flex}>{texts.reason(reason, day.date)}</AppText>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <AppText>{texts.profile(day)}</AppText>
      )}
      {day.recurring.length ? (
        <AppText variant="caption" color={colors.textMuted}>
          {t('outlook.usual', { names: texts.names(day.recurring) })}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  reasons: { gap: spacing.xs },
});
