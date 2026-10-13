import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TimeRow } from '@/components/settings/TimeRow';
import { AppText, Button } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { notificationsAvailable, requestPermission, shouldOfferReminder } from '@/lib/notifications';
import { PROMPT_DEFAULT_TIME } from '@/lib/notifications/prompt';
import { useOverlaySlot } from '@/lib/store/overlays';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { radius, spacing, useTheme, withAlpha } from '@/lib/theme';

/** Wait a moment after "Heute" appears, so the sheet does not land while the first screen settles. */
export const PROMPT_DELAY_MS = 600;
/** How long the hint after a refused permission stays before the sheet closes by itself. */
export const DENIED_HINT_MS = 5000;

/**
 * Offers the evening reminder once: on the first start, or once after the update for whoever has it
 * off. Only on "Heute" and never over the lock screen (the root layout mounts it only unlocked);
 * it goes before the streak celebration and the star message, which wait until it is closed.
 */
export function ReminderPrompt() {
  const settings = useSettingsStore((s) => s.settings);
  const pathname = usePathname();
  const offer =
    settings !== null &&
    shouldOfferReminder({
      available: notificationsAvailable(),
      reminderEnabled: settings.reminder_enabled,
      promptDone: settings.reminder_prompt_done,
      pathname,
    });
  // Once up, the sheet keeps its place until it closes itself, also while it shows the hint after
  // a refusal (by then the answer is stored and `offer` is false).
  const [open, setOpen] = useState(false);
  const mine = useOverlaySlot('reminderPrompt', offer || open);

  useEffect(() => {
    if (!mine || open) return;
    const timeout = setTimeout(() => setOpen(true), PROMPT_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [mine, open]);

  return mine && open ? <Sheet initialTime={settings?.reminder_time ?? PROMPT_DEFAULT_TIME} close={() => setOpen(false)} /> : null;
}

function Sheet({ initialTime, close }: { initialTime: string; close: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const update = useSettingsStore((s) => s.update);
  const [time, setTime] = useState(initialTime);
  const [asking, setAsking] = useState(false);
  const [denied, setDenied] = useState(false);

  /** Never asks again, whatever the answer. */
  const later = () => {
    update({ reminder_prompt_done: true });
    close();
  };

  const remind = () => {
    if (asking) return;
    setAsking(true);
    void requestPermission(t('notify.channel'))
      .catch(() => false)
      .then((granted) => {
        if (granted) {
          haptics.on();
          update({ reminder_enabled: true, reminder_time: time, reminder_yesterday_enabled: true, reminder_prompt_done: true });
          close();
          return;
        }
        update({ reminder_prompt_done: true });
        setAsking(false);
        setDenied(true);
      });
  };

  // The Android back button answers like "Später"; on the hint after a refusal it just closes.
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (denied) close();
      else later();
      return true;
    });
    return () => back.remove();
    // `later` and `close` only change with the render; the listener is renewed with `denied`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [denied]);

  useEffect(() => {
    if (!denied) return;
    const timeout = setTimeout(close, DENIED_HINT_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [denied]);

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(200)}
      exiting={reduceMotion ? undefined : FadeOut.duration(160)}
      style={[StyleSheet.absoluteFill, styles.backdrop, { backgroundColor: withAlpha(colors.text, 0.45) }]}
      accessibilityViewIsModal
    >
      <Animated.View
        entering={reduceMotion ? undefined : SlideInDown.duration(260).easing(Easing.out(Easing.cubic))}
        exiting={reduceMotion ? undefined : SlideOutDown.duration(160)}
        style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.xl }]}
      >
        <View style={[styles.icon, { backgroundColor: colors.accentSoft }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Ionicons name="notifications-outline" size={28} color={colors.accent} />
        </View>
        <AppText variant="headline" accessibilityRole="header">
          {t('reminderPrompt.title')}
        </AppText>
        {denied ? (
          <>
            <AppText accessibilityLiveRegion="polite">{t('reminderPrompt.denied')}</AppText>
            <Button label={t('reminderPrompt.ok')} onPress={close} />
          </>
        ) : (
          <>
            <AppText muted>{t('reminderPrompt.body')}</AppText>
            <TimeRow label={t('reminderPrompt.time')} value={time} onChange={setTime} />
            <AppText variant="caption" muted>
              {t('reminderPrompt.morning')}
            </AppText>
            <View style={styles.actions}>
              <Button
                label={t('reminderPrompt.later')}
                variant="secondary"
                accessibilityHint={t('reminderPrompt.laterHint')}
                disabled={asking}
                onPress={later}
                style={styles.action}
              />
              <Button
                label={t('reminderPrompt.remind')}
                accessibilityHint={t('reminderPrompt.remindHint')}
                disabled={asking}
                onPress={remind}
                style={styles.action}
              />
            </View>
          </>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { justifyContent: 'flex-end' },
  sheet: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    elevation: 18,
  },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: { flex: 1 },
});
