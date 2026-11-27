import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { AppText, Card, ListRow, Screen, Segmented, SelectRow, ToggleRow } from '@/components/ui';
import { getDb } from '@/db';
import { countRows, deleteAllData } from '@/db/repositories/maintenance';
import { loadSampleData } from '@/lib/dev/sample';
import { deviceLanguage, isLanguage, LANGUAGE_NAMES, LANGUAGES, upper } from '@/lib/i18n/language';
import { ShareUnavailableError } from '@/lib/export/files';
import { useBackupStatus } from '@/lib/export/useBackupStatus';
import { useDataTransfer } from '@/lib/export/useDataTransfer';
import { filePhotoStore } from '@/lib/photos/fileStore';
import { sweepPhotos } from '@/lib/photos/store';
import { useRateApp } from '@/lib/review/useReviewPrompt';
import { mutate, useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

export default function MoreScreen() {
  const { t } = useTranslation();
  const transfer = useDataTransfer();
  const guard = (action: () => Promise<void>) => () => {
    action().catch((error: unknown) => Alert.alert(t('common.error'), error instanceof ShareUnavailableError ? t('common.shareUnavailable') : error instanceof Error ? error.message : String(error)));
  };
  const go = (pathname: Href) => () => router.push(pathname);

  // Until the first own entry exists, any build may load the sample data once.
  const entries = useQuery(() => countRows(getDb()).entries, []);
  const loadSample = () => mutate(() => loadSampleData(getDb()));

  const updateSettings = useSettingsStore((s) => s.update);
  const firstDayOfWeek = useSettingsStore((s) => s.settings?.first_day_of_week ?? 1);
  const language = useSettingsStore((s) => s.settings?.language ?? deviceLanguage());
  const outlookEnabled = useSettingsStore((s) => s.settings?.outlook_enabled ?? true);
  const lockEnabled = useSettingsStore((s) => s.settings?.app_lock_enabled ?? false);
  const reminderEnabled = useSettingsStore((s) => s.settings?.reminder_enabled ?? false);
  // Every time of the daily reminder, earliest first; `reminder_time` alone is the latest.
  const reminderTime = useSettingsStore((s) => (s.settings?.reminder_times ?? []).join(', ') || (s.settings?.reminder_time ?? ''));
  const healthEnabled = useSettingsStore((s) => s.settings?.health_enabled ?? false);
  const designSeasons = useSettingsStore((s) => s.settings?.design_seasons ?? true);
  const designFestivals = useSettingsStore((s) => s.settings?.design_festivals ?? true);
  const colorScheme = useSettingsStore((s) => s.settings?.color_scheme ?? 'system');
  const backup = useBackupStatus();
  const rateApp = useRateApp();
  const autoBackupDir = useSettingsStore((s) => s.settings?.auto_backup_dir ?? null);
  const autoBackupFailed = useSettingsStore((s) => Boolean(s.settings?.auto_backup_error));
  const autoBackupValue = !autoBackupDir ? t('common.off') : autoBackupFailed ? t('autoBackup.statusFailed') : t('common.on');
  const backupValue = !backup.everExported
    ? t('settings.backupNever')
    : backup.days === 0
      ? t('settings.backupToday')
      : t('settings.backupAgo', { count: backup.days ?? 0 });

  return (
    <Screen title={t('settings.title')}>
      <Card>
        <AppText variant="caption" muted>
          {upper(t('settings.diarySection'))}
        </AppText>
        <ListRow icon="list-outline" label={t('settings.history')} onPress={go('/more/history')} />
        <ListRow icon="flag-outline" label={t('settings.turningPoints')} onPress={go('/more/history?turning=1')} />
      </Card>
      <Card>
        <AppText variant="caption" muted>
          {upper(t('manage.title'))}
        </AppText>
        <ListRow icon="pricetags-outline" label={t('manage.activities')} onPress={go('/more/activities')} />
        <ListRow icon="options-outline" label={t('manage.scales')} onPress={go('/more/scales')} />
      </Card>
      <Card>
        <AppText variant="caption" muted>
          {upper(t('settings.data'))}
        </AppText>
        <ListRow icon="download-outline" label={t('settings.import')} onPress={guard(transfer.pickImport)} />
        <ListRow icon="sync-outline" label={t('autoBackup.title')} value={autoBackupValue} onPress={go('/more/backup')} />
        <ListRow icon="share-outline" label={t('settings.exportJson')} value={backupValue} onPress={guard(transfer.exportJson)} />
        <ListRow icon="folder-outline" label={t('settings.saveJson')} onPress={guard(transfer.saveJson)} />
        <ListRow icon="grid-outline" label={t('settings.exportCsv')} onPress={guard(transfer.exportCsv)} />
        <ListRow icon="trash-outline" label={t('settings.deleteAll')} destructive onPress={go('/more/delete')} />
        <AppText variant="caption" muted>
          {t('settings.backupHint')}
        </AppText>
      </Card>
      <Card>
        <AppText variant="caption" muted>
          {upper(t('settings.languageSection'))}
        </AppText>
        {/* Each language under its own name, so the way back is readable from any of them. */}
        <SelectRow
          label={t('settings.language')}
          value={language}
          sections={[{ options: LANGUAGES.map((value) => ({ value, label: LANGUAGE_NAMES[value] })) }]}
          closeLabel={t('common.close')}
          onChange={(next) => {
            if (isLanguage(next)) updateSettings({ language: next });
          }}
        />
      </Card>
      <Card>
        <AppText variant="caption" muted>
          {upper(t('settings.designSection'))}
        </AppText>
        {/* "System" follows the phone, also when it switches by itself in the evening. */}
        <Segmented
          label={t('settings.colorScheme')}
          options={[
            { value: 'system', label: t('settings.colorSchemeSystem') },
            { value: 'light', label: t('settings.colorSchemeLight') },
            { value: 'dark', label: t('settings.colorSchemeDark') },
          ]}
          value={colorScheme}
          onChange={(next) => updateSettings({ color_scheme: next === 'system' ? null : next })}
        />
        <ToggleRow
          label={t('settings.designSeasons')}
          hint={t('settings.designSeasonsHint')}
          value={designSeasons}
          onChange={(design_seasons) => updateSettings({ design_seasons })}
        />
        <ToggleRow
          label={t('settings.designFestivals')}
          hint={t('settings.designFestivalsHint')}
          value={designFestivals}
          disabled={!designSeasons}
          onChange={(design_festivals) => updateSettings({ design_festivals })}
        />
      </Card>
      <Card>
        <AppText variant="caption" muted>
          {upper(t('settings.calendarSection'))}
        </AppText>
        <Segmented
          label={t('settings.weekStart')}
          options={[
            { value: 1, label: t('settings.monday') },
            { value: 0, label: t('settings.sunday') },
          ]}
          value={firstDayOfWeek}
          onChange={(first_day_of_week) => updateSettings({ first_day_of_week })}
        />
      </Card>
      <Card>
        <AppText variant="caption" muted>
          {upper(t('settings.outlookSection'))}
        </AppText>
        <ListRow
          icon="telescope-outline"
          label={t('settings.outlook')}
          value={outlookEnabled ? t('common.on') : t('common.off')}
          onPress={go('/more/outlook')}
        />
      </Card>
      <Card>
        <AppText variant="caption" muted>
          {upper(t('settings.healthSection'))}
        </AppText>
        <ListRow
          icon="heart-outline"
          label={t('settings.health')}
          value={healthEnabled ? t('common.on') : t('common.off')}
          onPress={go('/more/health')}
        />
      </Card>
      <Card>
        <AppText variant="caption" muted>
          {upper(t('settings.protection'))}
        </AppText>
        <ListRow
          icon="notifications-outline"
          label={t('settings.reminders')}
          value={reminderEnabled ? reminderTime : t('common.off')}
          onPress={go('/more/reminders')}
        />
        <ListRow icon="lock-closed-outline" label={t('settings.lock')} value={lockEnabled ? t('common.on') : t('common.off')} onPress={go('/more/lock')} />
      </Card>
      <Card>
        <AppText variant="caption" muted>
          {upper(t('settings.info'))}
        </AppText>
        <ListRow icon="shield-checkmark-outline" label={t('settings.privacyLabel')} onPress={go('/more/privacy')} />
        <ListRow icon="sparkles-outline" label={t('settings.changelog')} onPress={go('/more/changelog')} />
        <ListRow icon="information-circle-outline" label={t('settings.about')} onPress={go('/more/about')} />
        <ListRow icon="star-outline" label={t('settings.rate')} value={t('settings.rateStore')} onPress={rateApp} />
      </Card>
      {__DEV__ ? (
        <DevTools />
      ) : entries === 0 ? (
        <Card tone="muted">
          <ListRow icon="flask-outline" label={t('dev.seed')} onPress={loadSample} />
          <AppText variant="caption" muted>
            {t('dev.sampleHint')}
          </AppText>
        </Card>
      ) : null}
    </Screen>
  );
}

/** Dev-only: reseeding over existing data and wiping. Release builds only get the one-off sample row. */
function DevTools() {
  const { t } = useTranslation();
  const load = useSettingsStore((s) => s.load);
  const [counts, setCounts] = useState(() => countRows(getDb()));

  // Through `mutate`, so the other tabs re-read instead of showing the data that was just replaced.
  const seed = () => {
    mutate(() => {
      deleteAllData(getDb());
      loadSampleData(getDb());
    });
    sweepPhotos(getDb(), filePhotoStore);
    load();
    setCounts(countRows(getDb()));
  };
  const wipe = () => {
    mutate(() => deleteAllData(getDb()));
    sweepPhotos(getDb(), filePhotoStore);
    load();
    setCounts(countRows(getDb()));
  };

  return (
    <Card tone="muted">
      <AppText variant="caption" muted>
        {upper(t('dev.title'))}
      </AppText>
      <ListRow icon="flask-outline" label={t('dev.seed')} value={`${counts.entries} · ${counts.activities}`} onPress={seed} />
      <ListRow icon="nuclear-outline" label={t('dev.wipe')} destructive onPress={wipe} />
    </Card>
  );
}
