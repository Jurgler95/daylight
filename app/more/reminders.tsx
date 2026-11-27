import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { TimeRow, useTimePicker } from '@/components/settings/TimeRow';
import { AppText, Button, Card, Screen, ToggleRow } from '@/components/ui';
import { notificationsAvailable, requestPermission } from '@/lib/notifications';
import {
  addReminderTime,
  changeReminderTime,
  MAX_REMINDER_TIMES,
  reminderTimesOr,
  removeReminderTime,
  suggestReminderTime,
  type TimeListChange,
} from '@/lib/notifications/times';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { TOUCH_TARGET, spacing, useTheme } from '@/lib/theme';

export default function RemindersScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  // A time that was refused because the list already has it; gone with the next change that works.
  const [duplicate, setDuplicate] = useState(false);
  const times = reminderTimesOr(settings?.reminder_times, settings?.reminder_time ?? '');
  const apply = (change: TimeListChange) => {
    setDuplicate(!change.ok && change.reason === 'duplicate');
    if (change.ok) update({ reminder_times: change.times });
  };
  const adding = useTimePicker(suggestReminderTime(times), (time) => apply(addReminderTime(times, time)));
  if (!settings) return null;
  const available = notificationsAvailable();
  const on = settings.reminder_enabled;
  const several = times.length > 1;

  /**
   * The system permission is asked for when the reminder is switched on, here or in the start sheet
   * that offers it once (`components/reminders/ReminderPrompt.tsx`), never by itself at startup.
   * Switching it on here answers that sheet too.
   */
  const toggle = (value: boolean) => {
    if (!value) {
      update({ reminder_enabled: false });
      return;
    }
    void requestPermission(t('notify.channel'))
      .catch(() => false)
      .then((granted) => {
        if (granted) update({ reminder_enabled: true, reminder_prompt_done: true });
        else Alert.alert(t('reminders.title'), t('reminders.permissionDenied'));
      });
  };

  const dailyHint = settings.reminder_always
    ? several
      ? 'reminders.dailyHintAlwaysSeveral'
      : 'reminders.dailyHintAlways'
    : several
      ? 'reminders.dailyHintSeveral'
      : 'reminders.dailyHint';

  return (
    <Screen back title={t('reminders.title')} backLabel={t('common.back')}>
      {available ? null : (
        <Card tone="muted">
          <AppText>{t('reminders.unavailable')}</AppText>
        </Card>
      )}
      <Card>
        <ToggleRow label={t('reminders.daily')} hint={t(dailyHint)} value={on} onChange={toggle} />
        {/* One to five times a day, earliest first. Each asks for an entry of its own. */}
        {times.map((time, index) => (
          <View key={time} style={styles.time}>
            <View style={styles.flex}>
              <TimeRow
                label={several ? t('reminders.timeN', { n: index + 1 }) : t('reminders.dailyTime')}
                accessibilityLabel={t('reminders.changeTime', { time })}
                value={time}
                disabled={!on}
                onChange={(next) => apply(changeReminderTime(times, time, next))}
              />
            </View>
            {several ? (
              <Pressable
                onPress={() => apply(removeReminderTime(times, time))}
                disabled={!on}
                accessibilityRole="button"
                accessibilityLabel={t('reminders.removeTime', { time })}
                accessibilityState={{ disabled: !on }}
                style={({ pressed }) => [styles.remove, { opacity: !on ? 0.4 : pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="close-circle-outline" size={24} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        ))}
        {duplicate ? (
          <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
            {t('reminders.duplicateTime')}
          </AppText>
        ) : null}
        {times.length < MAX_REMINDER_TIMES ? (
          <>
            <Button label={t('reminders.addTime')} variant="secondary" disabled={!on} onPress={adding.open} />
            {adding.inline}
          </>
        ) : null}
        <ToggleRow
          label={t('reminders.always')}
          hint={t('reminders.alwaysHint')}
          value={settings.reminder_always}
          disabled={!on}
          onChange={(reminder_always) => update({ reminder_always })}
        />
      </Card>
      {/* The morning reminder only comes along with the daily one, so it waits while that is off. */}
      <Card>
        <ToggleRow
          label={t('reminders.yesterday')}
          hint={t('reminders.yesterdayHint')}
          value={settings.reminder_yesterday_enabled}
          disabled={!on}
          onChange={(reminder_yesterday_enabled) => update({ reminder_yesterday_enabled })}
        />
        <TimeRow
          label={t('reminders.yesterdayTime')}
          value={settings.reminder_yesterday_time}
          disabled={!on || !settings.reminder_yesterday_enabled}
          onChange={(reminder_yesterday_time) => update({ reminder_yesterday_time })}
        />
      </Card>
      <AppText variant="caption" muted>
        {t('reminders.moodButtons')}
      </AppText>
      <AppText variant="caption" muted>
        {t('reminders.discreet')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  time: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  remove: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
});
