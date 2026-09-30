import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, StyleSheet, View } from 'react-native';

import { AppText, Button, Logo, LogoBackdrop } from '@/components/ui';
import { authenticate, isLockAvailable, useLockStore } from '@/lib/lock';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { spacing, useTheme } from '@/lib/theme';

/** Covers the whole app while it is locked. Shows nothing but the logo and the app name (from Zyklus). */
export function LockScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const unlock = useLockStore((s) => s.unlock);
  const updateSettings = useSettingsStore((s) => s.update);
  const [failed, setFailed] = useState(false);
  const prompted = useRef(false);

  const prompt = useCallback(async () => {
    // A phone whose screen lock was removed must not lock the user out of their own diary.
    if (!(await isLockAvailable())) {
      updateSettings({ app_lock_enabled: false });
      unlock();
      return;
    }
    const result = await authenticate(t('lock.prompt'), t('common.cancel')).catch(() => ({ success: false, cancelled: false }));
    if (result.success) {
      setFailed(false);
      unlock();
    } else {
      setFailed(true);
    }
  }, [t, unlock, updateSettings]);

  // The navigator stays mounted underneath (see `app/_layout.tsx`); Android back must not move it.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (prompted.current) return;
    prompted.current = true;
    void prompt();
  }, [prompt]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} accessibilityViewIsModal>
      <LogoBackdrop />
      <Logo size={88} />
      <AppText variant="title" accessibilityRole="header">
        {t('app.name')}
      </AppText>
      {failed ? <AppText muted>{t('lock.failed')}</AppText> : null}
      <Button label={t('lock.unlock')} onPress={() => void prompt()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
});
