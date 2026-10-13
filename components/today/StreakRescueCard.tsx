import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { formatShort, type DateString } from '@/lib/dates';
import { formatCount } from '@/lib/insights';
import { spacing, useTheme } from '@/lib/theme';

interface Props {
  /** Days still without an entry, oldest first. */
  missing: readonly DateString[];
  /** The streak once all of them are filled in. */
  restoredDays: number;
  onFillIn: (date: DateString) => void;
  onDismiss: () => void;
}

/**
 * A gap of up to a week can still be filled in, behind a broken streak or behind the run still
 * going (when yesterday was filled in first). The button opens the oldest missing day; after each
 * save the card moves on to the next one until the gap is closed. "Later" puts it away until the
 * next gap.
 */
export function StreakRescueCard({ missing, restoredDays, onFillIn, onDismiss }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const next = missing[0];
  if (!next) return null;
  return (
    <Card tone="muted">
      <View style={styles.head}>
        <Ionicons name="flame-outline" size={22} color={colors.textMuted} />
        <AppText variant="headline" accessibilityRole="header" style={styles.title}>
          {t('streak.rescue.title', { count: missing.length })}
        </AppText>
      </View>
      <AppText>{t('streak.rescue.body', { count: restoredDays, value: formatCount(restoredDays) })}</AppText>
      <View style={styles.actions}>
        <Button label={t('streak.rescue.action', { date: formatShort(next) })} variant="secondary" onPress={() => onFillIn(next)} />
        <Button label={t('streak.rescue.later')} accessibilityHint={t('streak.rescue.laterHint')} variant="ghost" onPress={onDismiss} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
