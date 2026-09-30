import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { AppText, Card, OptionRow, Screen, ToggleRow } from '@/components/ui';
import { authenticate, isLockAvailable } from '@/lib/lock';
import { useSettingsStore } from '@/lib/store/settingsStore';

const DELAYS = [0, 60, 300, 900];

export default function LockScreenSettings() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    void isLockAvailable().then(setAvailable);
  }, []);

  if (!settings) return null;
  const enabled = settings.app_lock_enabled;

  /** Turning the lock on requires one successful unlock, so nobody locks themselves out by accident. */
  const toggle = (value: boolean) => {
    if (!value) {
      update({ app_lock_enabled: false });
      return;
    }
    if (available === false) {
      Alert.alert(t('lock.title'), t('lock.unavailable'));
      return;
    }
    void authenticate(t('lock.prompt'), t('common.cancel')).then((result) => {
      if (result.success) update({ app_lock_enabled: true });
      else if (!result.cancelled) Alert.alert(t('lock.title'), t('lock.failed'));
    });
  };

  const delayLabel = (seconds: number) =>
    seconds === 0 ? t('lock.delayImmediate') : t('lock.delayMinutes', { count: seconds / 60 });

  return (
    <Screen back title={t('lock.title')} backLabel={t('common.back')}>
      <Card>
        <ToggleRow label={t('lock.enable')} hint={t('lock.enableHint')} value={enabled} onChange={toggle} />
        {available === false ? (
          <AppText variant="caption" muted>
            {t('lock.unavailable')}
          </AppText>
        ) : null}
      </Card>
      <Card>
        <AppText variant="headline">{t('lock.delay')}</AppText>
        {DELAYS.map((seconds) => (
          <OptionRow
            key={seconds}
            label={delayLabel(seconds)}
            selected={settings.app_lock_delay_seconds === seconds}
            onPress={() => update({ app_lock_delay_seconds: seconds })}
          />
        ))}
      </Card>
      <AppText variant="caption" muted>
        {t('lock.secure')}
      </AppText>
    </Screen>
  );
}
