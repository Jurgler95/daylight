import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { AppText, Card, ListRow, Screen } from '@/components/ui';
import { formatLong, toDateString, toTimeString } from '@/lib/dates';
import { AUTO_BACKUP_KEEP, classifyAutoBackupError, folderLabel } from '@/lib/export/auto';
import { pickBackupFolder } from '@/lib/export/autoFolder';
import { ShareUnavailableError } from '@/lib/export/files';
import { autoBackupNow } from '@/lib/export/useAutoBackup';
import { useDataTransfer } from '@/lib/export/useDataTransfer';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { useTheme } from '@/lib/theme';

/**
 * "Automatische Sicherung": one folder picked once, written by the app on start and after changes,
 * at most once a day (`lib/export/auto.ts`). Shows when it last worked and why it did not.
 */
export default function AutoBackupScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const { saveJson } = useDataTransfer();
  if (!settings) return null;

  const dir = settings.auto_backup_dir;
  const lastAt = settings.auto_backup_at ? new Date(settings.auto_backup_at) : null;
  const lastLabel =
    lastAt && !Number.isNaN(lastAt.getTime())
      ? t('autoBackup.lastAt', { date: formatLong(toDateString(lastAt)), time: toTimeString(lastAt) })
      : t('autoBackup.lastNever');
  const describe = (message: string) => {
    const kind = classifyAutoBackupError(message);
    return kind === 'folder' ? t('autoBackup.errorFolder') : kind === 'space' ? t('autoBackup.errorSpace') : t('autoBackup.errorOther', { message });
  };
  const error = settings.auto_backup_error;

  const report = (result: ReturnType<typeof autoBackupNow>) => {
    if (result === 'written') Alert.alert(t('autoBackup.done'));
    // The run has just refreshed the settings, so the store holds its error.
    else if (result === 'failed') Alert.alert(t('autoBackup.failed'), describe(useSettingsStore.getState().settings?.auto_backup_error ?? ''));
  };

  const choose = async () => {
    const uri = await pickBackupFolder();
    if (!uri) return;
    // A new folder starts fresh: the first backup goes there right away, whatever was written today.
    update({ auto_backup_dir: uri, auto_backup_error: null, auto_backup_hash: null, auto_backup_tried_at: null });
    report(autoBackupNow(true));
  };

  const turnOff = () => {
    Alert.alert(t('autoBackup.offTitle'), t('autoBackup.offBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('autoBackup.off'),
        style: 'destructive',
        onPress: () => update({ auto_backup_dir: null, auto_backup_at: null, auto_backup_tried_at: null, auto_backup_error: null, auto_backup_hash: null }),
      },
    ]);
  };

  const saveOnce = () => {
    saveJson().catch((failure: unknown) =>
      Alert.alert(t('common.error'), failure instanceof ShareUnavailableError ? t('common.shareUnavailable') : failure instanceof Error ? failure.message : String(failure)),
    );
  };

  return (
    <Screen back title={t('autoBackup.title')} backLabel={t('common.back')}>
      <Card>
        <AppText variant="caption" muted>
          {t('autoBackup.folder')}
        </AppText>
        <AppText>{dir ? folderLabel(dir) : t('autoBackup.noFolder')}</AppText>
        {dir ? (
          <>
            <AppText muted>{lastLabel}</AppText>
            {error ? <AppText color={colors.danger}>{describe(error)}</AppText> : null}
          </>
        ) : null}
        <ListRow icon="folder-open-outline" label={dir ? t('autoBackup.change') : t('autoBackup.choose')} onPress={() => void choose()} />
        {dir ? (
          <>
            <ListRow icon="refresh-outline" label={t('backup.now')} onPress={() => report(autoBackupNow(true))} />
            <ListRow icon="close-circle-outline" label={t('autoBackup.off')} destructive onPress={turnOff} />
          </>
        ) : null}
      </Card>
      <AppText variant="caption" muted>
        {t('autoBackup.howItWorks', { keep: AUTO_BACKUP_KEEP })}
      </AppText>
      <AppText variant="caption" muted>
        {t('autoBackup.restore')}
      </AppText>
      {!dir ? (
        <Card>
          <ListRow icon="save-outline" label={t('settings.saveJson')} onPress={saveOnce} />
        </Card>
      ) : null}
    </Screen>
  );
}
