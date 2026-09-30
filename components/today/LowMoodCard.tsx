import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { spacing } from '@/lib/theme';

/** German counselling line, free and around the clock. */
const PHONE = 'tel:08001110111';

/**
 * A quiet note after a long low stretch: no alarm, no judgement, one number and a way to put it
 * away. The rule lives in `lib/support/lowMood.ts`.
 */
export function LowMoodCard({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <Card tone="muted">
      <AppText variant="headline" accessibilityRole="header">
        {t('lowMood.title')}
      </AppText>
      <AppText>{t('lowMood.body')}</AppText>
      <View style={styles.actions}>
        <Button
          label={t('lowMood.call')}
          accessibilityLabel={t('lowMood.callLabel')}
          variant="secondary"
          onPress={() => void Linking.openURL(PHONE).catch(() => undefined)}
        />
        <Button label={t('lowMood.later')} accessibilityHint={t('lowMood.laterHint')} variant="ghost" onPress={onDismiss} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
