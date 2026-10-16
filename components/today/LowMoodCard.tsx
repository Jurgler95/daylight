import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { currentLanguage } from '@/lib/i18n/language';
import { deviceHelpline, dialUrl, helplineName } from '@/lib/support/helplines';
import { spacing } from '@/lib/theme';

/**
 * A quiet note after a long low stretch: no alarm, no judgement, one number and a way to put it
 * away. The number is the crisis line of the device's region (`lib/support/helplines.ts`); where
 * none is known, the note names no number. The rule lives in `lib/support/lowMood.ts`.
 */
export function LowMoodCard({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  const helpline = deviceHelpline();
  const name = helpline ? helplineName(helpline, currentLanguage()) : '';
  const line = helpline
    ? helpline.hours
      ? t('lowMood.lineHours', { name, number: helpline.number, from: helpline.hours.from, to: helpline.hours.to })
      : t('lowMood.lineAllDay', { name, number: helpline.number })
    : t('lowMood.noLine');
  return (
    <Card tone="muted">
      <AppText variant="headline" accessibilityRole="header">
        {t('lowMood.title')}
      </AppText>
      <AppText>{`${t('lowMood.body')} ${line}`}</AppText>
      <View style={styles.actions}>
        {helpline ? (
          <Button
            label={t('lowMood.call', { number: helpline.number })}
            accessibilityLabel={t('lowMood.callLabel', { name, number: helpline.number })}
            variant="secondary"
            onPress={() => void Linking.openURL(dialUrl(helpline)).catch(() => undefined)}
          />
        ) : null}
        <Button label={t('lowMood.later')} accessibilityHint={t('lowMood.laterHint')} variant="ghost" onPress={onDismiss} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
