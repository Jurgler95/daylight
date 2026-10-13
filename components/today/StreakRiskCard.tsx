import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { formatCount } from '@/lib/insights';
import { spacing, useTheme } from '@/lib/theme';

interface Props {
  /** The run up to the day before yesterday, what filling in yesterday keeps. */
  days: number;
  onFillIn: () => void;
}

/** Yesterday has no entry yet: one calm line and the way to write it. No countdown, nothing to put away. */
export function StreakRiskCard({ days, onFillIn }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Card>
      <View style={styles.head}>
        <Ionicons name="flame" size={22} color={colors.amber} />
        <AppText variant="headline" accessibilityRole="header" style={styles.title}>
          {t('streak.risk.title')}
        </AppText>
      </View>
      <AppText>{t('streak.risk.body', { count: days, value: formatCount(days) })}</AppText>
      <View style={styles.actions}>
        <Button label={t('streak.risk.action')} variant="secondary" onPress={onFillIn} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
