import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HealthSyncIndicator } from '@/components/health/HealthSyncIndicator';
import { LockScreen } from '@/components/lock/LockScreen';
import { AppText, Button, LogoBackdrop } from '@/components/ui';
import { useHealthSync } from '@/lib/health/useHealthSync';
import { useAppLock } from '@/lib/lock';
import { useReminderSync } from '@/lib/notifications';
import { spacing, useTheme } from '@/lib/theme';
import { useAppBootstrap } from '@/lib/useAppBootstrap';

import '@/lib/i18n';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <Root />
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Keeps the splash screen up until the database is migrated and the settings are loaded. */
function Root() {
  const bootstrap = useAppBootstrap();
  const { colors } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    if (bootstrap.state !== 'loading') SplashScreen.hide();
  }, [bootstrap.state]);

  if (bootstrap.state === 'loading') return null;

  if (bootstrap.state === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <LogoBackdrop />
        <AppText variant="headline">{t('common.error')}</AppText>
        <AppText muted>{bootstrap.error.message}</AppText>
        <Button label={t('common.retry')} onPress={bootstrap.retry} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <AppShell />
    </>
  );
}

/**
 * Everything that needs a migrated database and loaded settings lives below this component.
 * The lock screen lies over the navigator instead of replacing it: an entry being written when the
 * phone went to sleep is still there after unlocking. Underneath, nothing is reachable for touch or
 * the screen reader, and FLAG_SECURE keeps it out of the recents preview.
 */
function AppShell() {
  const { colors } = useTheme();
  const { locked } = useAppLock();

  return (
    <>
      <ReminderSync />
      <HealthSync />
      <View style={styles.flex} importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={locked}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="entry/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="entry/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="photo/[name]" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: '#000000' } }} />
        </Stack>
      </View>
      {locked ? (
        <View style={StyleSheet.absoluteFill}>
          <LockScreen />
        </View>
      ) : (
        <HealthSyncIndicator />
      )}
    </>
  );
}

/**
 * Its own component because it re-renders on every write; inside `AppShell` that would re-render
 * the whole navigator, and every screen in it, on each tap (Zyklus).
 */
function ReminderSync() {
  useReminderSync();
  return null;
}

/** Its own component for the same reason as `ReminderSync`. */
function HealthSync() {
  useHealthSync();
  return null;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
});
