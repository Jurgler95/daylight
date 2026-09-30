import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { useBackupStatus } from '@/lib/export/useBackupStatus';
import { useDataTransfer } from '@/lib/export/useDataTransfer';
import { TOUCH_TARGET, spacing } from '@/lib/theme';

/**
 * Appears only once a backup is overdue (60 days, `lib/export/backup.ts`). Android's own backup is
 * off for this app (`allowBackup: false`), so this card is all that stands between the diary and a
 * lost phone (from Zyklus, Phase 10).
 */
export function BackupCard() {
  const { t } = useTranslation();
  const status = useBackupStatus();
  const { saveJson } = useDataTransfer();
  if (!status.due) return null;

  const save = () => {
    saveJson().catch((error: unknown) => Alert.alert(t('common.error'), error instanceof Error ? error.message : String(error)));
  };

  return (
    <Card tone="muted" style={styles.card}>
      <View style={styles.text}>
        <AppText variant="label">{t('backup.title')}</AppText>
        <AppText variant="caption" muted>
          {status.everExported ? t('backup.bodyAgo', { count: status.days ?? 0 }) : t('backup.bodyNever')}
        </AppText>
      </View>
      <Button label={t('backup.now')} variant="secondary" style={styles.action} onPress={save} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, gap: spacing.md },
  text: { flex: 1, gap: 2 },
  action: { minHeight: TOUCH_TARGET, paddingHorizontal: spacing.lg },
});
