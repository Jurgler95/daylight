import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, TextInput } from 'react-native';

import { AppText, Button, Card, Screen } from '@/components/ui';
import { dropDatabaseFile, runMigrations } from '@/db';
import { revokeAccess } from '@/lib/health/client';
import { cancelAll } from '@/lib/notifications';
import { deleteAllPhotoFiles } from '@/lib/photos/fileStore';
import { mutate } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

/** Deletes the database file itself and migrates a fresh one, after the word is typed. */
export default function DeleteDataScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const load = useSettingsStore((s) => s.load);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const word = t('settings.deleteWord');
  const confirmed = typed.trim().toUpperCase() === word;

  const run = async () => {
    setBusy(true);
    try {
      // The settings that switched the reminder on are about to go; so are its scheduled dates.
      await cancelAll().catch(() => undefined);
      // Nothing is left that Health Connect access would be for.
      await revokeAccess().catch(() => undefined);
      dropDatabaseFile();
      deleteAllPhotoFiles();
      await runMigrations();
      mutate(() => load());
      router.back();
      Alert.alert(t('settings.deleted'));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back title={t('settings.deleteAll')} backLabel={t('common.back')}>
      <Card>
        <AppText>{t('settings.deleteBody')}</AppText>
        <AppText muted>{t('settings.deleteBackupHint')}</AppText>
      </Card>
      <Card>
        <AppText variant="label">{t('settings.deleteConfirm', { word })}</AppText>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel={t('settings.deleteConfirm', { word })}
          placeholder={word}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { backgroundColor: colors.surfaceMuted, color: colors.text }]}
        />
        <Button label={t('settings.deleteAll')} disabled={!confirmed || busy} onPress={() => void run()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: TOUCH_TARGET, borderRadius: radius.sm, paddingHorizontal: spacing.lg, fontSize: 16 },
});
