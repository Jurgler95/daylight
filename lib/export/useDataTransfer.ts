import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { getDb } from '@/db';
import { today } from '@/lib/dates';
import { readDaylioRows } from '@/lib/daylio/rows';
import { daylioFileName, writeDaylioCsv } from '@/lib/daylio/write';
import { filePhotoStore } from '@/lib/photos/fileStore';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { archiveFileName, writeBackupArchive } from './archive';
import { pickImportFile, saveBinaryToPickedDirectory, saveToPickedDirectory, shareBinary, shareText } from './files';
import { readImportBytes, UnknownFormatError, usePendingImport } from './pending';
import { buildExport, exportFileName } from './serialize';

const appVersion = (): string => Constants.expoConfig?.version ?? '0.0.0';

/** Screen-facing actions for "Mehr". Importing only parses here; writing happens after the preview. */
export function useDataTransfer() {
  const { t } = useTranslation();
  const updateSettings = useSettingsStore((s) => s.update);
  const setPending = usePendingImport((s) => s.set);
  // Only a full JSON snapshot counts as a backup; the CSV drops groups, icons, plans and settings.
  const markBackedUp = useCallback(() => updateSettings({ last_export_at: new Date().toISOString() }), [updateSettings]);

  // With photos the backup is a ZIP (JSON plus the photo files), without it stays plain JSON.
  const exportJson = useCallback(async () => {
    const payload = buildExport(getDb(), appVersion());
    if (payload.entry_photos.length > 0) {
      await shareBinary(archiveFileName(today()), 'application/zip', (write) => writeBackupArchive(payload, filePhotoStore, write));
    } else {
      await shareText(exportFileName(today()), 'application/json', JSON.stringify(payload, null, 2));
    }
    markBackedUp();
  }, [markBackedUp]);

  const saveJson = useCallback(async () => {
    const payload = buildExport(getDb(), appVersion());
    const saved =
      payload.entry_photos.length > 0
        ? await saveBinaryToPickedDirectory(archiveFileName(today()), 'application/zip', (write) => writeBackupArchive(payload, filePhotoStore, write))
        : await saveToPickedDirectory(exportFileName(today()), 'application/json', JSON.stringify(payload, null, 2));
    if (!saved) return;
    markBackedUp();
    Alert.alert(t('settings.saved'));
  }, [markBackedUp, t]);

  const exportCsv = useCallback(async () => {
    await shareText(daylioFileName(today()), 'text/csv', writeDaylioCsv(readDaylioRows(getDb())));
  }, []);

  const pickImport = useCallback(async () => {
    const picked = await pickImportFile();
    if (!picked) return;
    try {
      setPending(readImportBytes(picked.name, picked.bytes));
    } catch (error) {
      const message = error instanceof UnknownFormatError ? t('settings.unknownFile') : error instanceof Error ? error.message.slice(0, 300) : String(error);
      Alert.alert(t('settings.invalidFile'), message);
      return;
    }
    router.push('/more/import');
  }, [setPending, t]);

  return { exportJson, saveJson, exportCsv, pickImport };
}
