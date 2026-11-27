import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { useBackupHint } from '@/lib/export/useBackupStatus';
import { spacing } from '@/lib/theme';

/**
 * A quiet card at the end of "Heute", never a popup. Without automatic backup it comes once the
 * last backup is a month old (or never happened and the first entry is a month old); with one it
 * comes only when that keeps failing. Both lead to "Automatische Sicherung" and can be put away
 * (`lib/export/backup.ts`). Android's own backup is off for this app (`allowBackup: false`), so
 * this is all that stands between the diary and a lost phone.
 */
export function BackupCard() {
  const { t } = useTranslation();
  const { hint, status, dismiss } = useBackupHint();
  if (hint === 'none') return null;

  const failing = hint === 'failing';
  const body = failing
    ? t('backup.bodyFailing')
    : status.everExported
      ? t('backup.bodyAgo', { count: status.days ?? 0 })
      : t('backup.bodyNever');

  return (
    <Card tone="muted">
      <View style={styles.text}>
        <AppText variant="label">{failing ? t('backup.titleFailing') : t('backup.title')}</AppText>
        <AppText variant="caption" muted>
          {failing ? body : `${body} ${t('backup.autoOffer')}`}
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button label={failing ? t('backup.check') : t('backup.setUp')} variant="secondary" onPress={() => router.push('/more/backup')} />
        <Button label={t('backup.later')} accessibilityHint={t('backup.laterHint')} variant="ghost" onPress={dismiss} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  text: { gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
