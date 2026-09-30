import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { TimeRow } from '@/components/settings/TimeRow';
import { AppText, Card, Screen, ToggleRow } from '@/components/ui';
import { notificationsAvailable, requestPermission } from '@/lib/notifications';
import { useSettingsStore } from '@/lib/store/settingsStore';

export default function RemindersScreen() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  if (!settings) return null;
  const available = notificationsAvailable();

  /** The system permission is only asked for when the reminder is switched on, never at startup. */
  const toggle = (value: boolean) => {
    if (!value) {
      update({ reminder_enabled: false });
      return;
    }
    void requestPermission(t('notify.channel')).then((granted) => {
      if (granted) update({ reminder_enabled: true });
      else Alert.alert(t('reminders.title'), t('reminders.permissionDenied'));
    });
  };

  return (
    <Screen back title={t('reminders.title')} backLabel={t('common.back')}>
      {available ? null : (
        <Card tone="muted">
          <AppText>{t('reminders.unavailable')}</AppText>
        </Card>
      )}
      <Card>
        <ToggleRow label={t('reminders.daily')} hint={t('reminders.dailyHint')} value={settings.reminder_enabled} onChange={toggle} />
        <TimeRow
          label={t('reminders.time')}
          value={settings.reminder_time}
          disabled={!settings.reminder_enabled}
          onChange={(reminder_time) => update({ reminder_time })}
        />
      </Card>
      <AppText variant="caption" muted>
        {t('reminders.discreet')}
      </AppText>
    </Screen>
  );
}
