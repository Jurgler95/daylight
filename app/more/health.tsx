import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { AppText, Card, ListRow, Screen, ToggleRow } from '@/components/ui';
import { getDb } from '@/db';
import { clearHealthDays, countHealthDays, firstHealthDate } from '@/db/repositories/health';
import { formatLong, formatShortWithYear, toDateString, toTimeString } from '@/lib/dates';
import { healthStatus, openHealthConnect, requestAccess, revokeAccess, type HealthStatus } from '@/lib/health/client';
import { useHealthSyncStore } from '@/lib/health/store';
import { runHealthSync } from '@/lib/health/useHealthSync';
import { mutate, useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

const RESET = { health_enabled: false, health_synced_from: null, health_last_sync_at: null, health_last_error: null } as const;

export default function HealthScreen() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const running = useHealthSyncStore((s) => s.running);
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const days = useQuery(() => countHealthDays(getDb()), []);
  const first = useQuery(() => firstHealthDate(getDb()), []);

  useEffect(() => {
    void healthStatus().then(setStatus);
  }, []);

  if (!settings) return null;
  const enabled = settings.health_enabled;

  const sync = (force: boolean) => {
    void runHealthSync(force).catch((error: unknown) => Alert.alert(t('common.error'), error instanceof Error ? error.message : String(error)));
  };

  /** The Health Connect dialog only appears when the switch is turned on, never at startup. */
  const toggle = (value: boolean) => {
    if (!value) {
      update({ health_enabled: false });
      return;
    }
    if (status === 'update' || status === 'missing') {
      Alert.alert(t('health.title'), t(status === 'update' ? 'health.needsUpdate' : 'health.missing'));
      return;
    }
    void requestAccess()
      .then((granted) => {
        if (granted.size === 0) {
          Alert.alert(t('health.title'), t('health.denied'));
          return;
        }
        update({ health_enabled: true, health_last_error: null });
        sync(true);
      })
      .catch((error: unknown) => Alert.alert(t('common.error'), error instanceof Error ? error.message : String(error)));
  };

  /** After allowing older data later on: forget how far the backfill got and read everything again. */
  const reread = () => {
    update({ health_synced_from: null, health_last_sync_at: null });
    sync(true);
  };

  const disconnect = () => {
    Alert.alert(t('health.disconnect'), t('health.disconnectBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('health.disconnectConfirm'),
        style: 'destructive',
        onPress: () => {
          update(RESET);
          mutate(() => clearHealthDays(getDb()));
          void revokeAccess().catch(() => undefined);
        },
      },
    ]);
  };

  const lastSync = settings.health_last_sync_at ? new Date(settings.health_last_sync_at) : null;
  const lastSyncLabel = running
    ? t('health.running')
    : lastSync
      ? t('health.lastSyncAt', { date: formatLong(toDateString(lastSync)), time: toTimeString(lastSync) })
      : t('health.never');

  if (status === 'unsupported') {
    return (
      <Screen back title={t('health.title')} backLabel={t('common.back')}>
        <Card tone="muted">
          <AppText>{t('health.unsupported')}</AppText>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen back title={t('health.title')} backLabel={t('common.back')}>
      {status === 'missing' || status === 'update' ? (
        <Card tone="muted">
          <AppText>{t(status === 'update' ? 'health.needsUpdate' : 'health.missing')}</AppText>
        </Card>
      ) : null}
      <Card>
        <ToggleRow label={t('health.enable')} hint={t('health.enableHint')} value={enabled} disabled={status === null} onChange={toggle} />
      </Card>
      {enabled || days > 0 ? (
        <Card>
          <AppText variant="caption" muted>
            {t('health.state').toUpperCase()}
          </AppText>
          <AppText>{lastSyncLabel}</AppText>
          <AppText muted>
            {days > 0 && first ? t('health.coverage', { count: days, date: formatShortWithYear(first) }) : t('health.noDays')}
          </AppText>
          {settings.health_last_error ? (
            <AppText muted>{t('health.lastError', { message: settings.health_last_error })}</AppText>
          ) : null}
          {enabled ? (
            <>
              <ListRow icon="refresh-outline" label={t('health.syncNow')} onPress={() => sync(true)} />
              <ListRow icon="time-outline" label={t('health.reread')} onPress={reread} />
            </>
          ) : null}
          <ListRow icon="open-outline" label={t('health.manage')} onPress={openHealthConnect} />
          <ListRow icon="unlink-outline" label={t('health.disconnect')} destructive onPress={disconnect} />
        </Card>
      ) : null}
      <AppText variant="caption" muted>
        {t('health.historyHint')}
      </AppText>
      <AppText variant="caption" muted>
        {t('health.readOnly')}
      </AppText>
    </Screen>
  );
}
