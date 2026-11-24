import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { spacing, useTheme } from '@/lib/theme';

interface Props {
  onRate: () => void;
  onDismiss: () => void;
}

/**
 * Asks once for a rating in the Play Store, right after a save once entries were written on seven
 * days (`lib/review/prompt.ts`). No question first and nothing promised in return. "Bewerten" opens
 * the store page, "Nicht jetzt" closes; either answer puts the card away for good.
 */
export function ReviewCard({ onRate, onDismiss }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Card tone="muted">
      <View style={styles.head}>
        <Ionicons name="star-outline" size={22} color={colors.textMuted} />
        <AppText variant="headline" accessibilityRole="header" style={styles.title}>
          {t('review.title')}
        </AppText>
      </View>
      <AppText>{t('review.body')}</AppText>
      <View style={styles.actions}>
        <Button label={t('review.rate')} accessibilityHint={t('review.rateHint')} variant="secondary" onPress={onRate} />
        <Button label={t('review.later')} variant="ghost" onPress={onDismiss} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
