import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { IssueList } from '@/components/import/IssueList';
import { ActivityMapping, MoodMapping } from '@/components/import/Mapping';
import { AppText, Button, Card, EmptyState, Screen, Segmented, ToggleRow } from '@/components/ui';
import { getDb } from '@/db';
import type { ImportMode } from '@/lib/daylio/apply';
import type { ImportChoices } from '@/lib/daylio/plan';
import { applyPendingImport, usePendingImport } from '@/lib/export/pending';
import { summaryText } from '@/lib/export/summary';
import { useImportPreview } from '@/lib/export/useImportPreview';
import { haptics } from '@/lib/haptics';
import { filePhotoStore } from '@/lib/photos/fileStore';
import { mutate } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { useTheme } from '@/lib/theme';

/** Preview, mapping and confirmation. Nothing is written before "Importieren". */
export default function ImportScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const file = usePendingImport((s) => s.file);
  const setFile = usePendingImport((s) => s.set);
  const reloadSettings = useSettingsStore((s) => s.load);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [choices, setChoices] = useState<ImportChoices>({});
  const [skipErrors, setSkipErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const preview = useImportPreview(file, choices);

  if (!file || !preview) {
    return (
      <Screen back title={t('import.title')} backLabel={t('common.back')}>
        <EmptyState icon="document-outline" label={t('import.noFile')} />
      </Screen>
    );
  }

  const blocked = preview.errors.length > 0 && !skipErrors;
  const run = () => {
    setBusy(true);
    try {
      const added = mutate(() => applyPendingImport(getDb(), file, { mode, choices, skipErrors, store: filePhotoStore }));
      reloadSettings();
      haptics.confirm();
      setFile(null);
      router.back();
      Alert.alert(t('import.done', { count: added }));
    } catch (error) {
      Alert.alert(t('import.failed'), error instanceof Error ? error.message.slice(0, 300) : String(error));
    } finally {
      setBusy(false);
    }
  };
  const confirm = () => {
    if (mode === 'merge') return run();
    Alert.alert(t('import.replaceConfirm'), t(file.kind === 'csv' ? 'import.replaceWarningCsv' : 'import.replaceWarningJson'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('import.replace'), style: 'destructive', onPress: run },
    ]);
  };

  return (
    <Screen back title={t('import.title')} eyebrow={file.name} backLabel={t('common.back')}>
      <Card tone="accent">
        <AppText>{summaryText(t, preview.summary)}</AppText>
      </Card>
      {preview.errors.length > 0 || preview.warnings.length > 0 ? (
        <Card>
          <IssueList
            title={t('import.errorsTitle', { count: preview.errors.length })}
            color={colors.danger}
            lines={preview.errors.map((error) => t(`import.error.${error.code}`, { line: error.line, value: error.value }))}
          />
          {preview.errors.length > 0 ? <ToggleRow label={t('import.skipErrors')} value={skipErrors} onChange={setSkipErrors} /> : null}
          <IssueList
            title={t('import.warningsTitle', { count: preview.warnings.length })}
            lines={preview.warnings.map((warning) => t(`import.warning.${warning.code}`, { line: warning.line, value: warning.value }))}
          />
        </Card>
      ) : null}
      <MoodMapping
        moods={preview.newMoods}
        onChange={(key, level) => setChoices((c) => ({ ...c, moodLevels: { ...c.moodLevels, [key]: level } }))}
      />
      <ActivityMapping
        activities={preview.newActivities}
        groups={preview.groupNames}
        onChange={(key, group) => setChoices((c) => ({ ...c, activityGroups: { ...c.activityGroups, [key]: group } }))}
      />
      <Card>
        <Segmented
          label={t('import.mode')}
          options={[
            { value: 'merge', label: t('import.merge') },
            { value: 'replace', label: t('import.replace') },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === 'replace' ? (
          <AppText variant="caption" color={colors.danger}>
            {t(file.kind === 'csv' ? 'import.replaceWarningCsv' : 'import.replaceWarningJson')}
          </AppText>
        ) : null}
        <Button label={t('import.run')} disabled={blocked || busy || preview.summary.entries === 0} onPress={confirm} />
      </Card>
    </Screen>
  );
}
