import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { NameField } from '@/components/manage/NameField';
import { AppText, Card, EmptyState, Screen, ToggleRow } from '@/components/ui';
import { getDb } from '@/db';
import { listScales, updateScale } from '@/db/repositories/scales';
import { useManageWrite } from '@/lib/manage/useManageWrite';
import { useQuery } from '@/lib/store/dataVersion';

export default function ScaleScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const scaleId = Number(id);
  const write = useManageWrite();
  const scale = useQuery(() => listScales(getDb(), { includeArchived: true }).find((candidate) => candidate.id === scaleId), [scaleId]);

  if (!scale) {
    return (
      <Screen back title={t('manage.scales')}>
        <EmptyState icon="help-circle-outline" label={t('manage.gone')} />
      </Screen>
    );
  }

  return (
    <Screen back title={scale.name}>
      <Card>
        <NameField key={scale.id} label={t('manage.name')} value={scale.name} onCommit={(name) => write(() => updateScale(getDb(), scale.id, { name }))} />
        <AppText muted>{t('manage.range', { min: scale.min, max: scale.max })}</AppText>
      </Card>
      <Card>
        <ToggleRow
          label={t('manage.archive')}
          hint={t('manage.archiveScaleHint')}
          value={scale.archived}
          onChange={(archived) => write(() => updateScale(getDb(), scale.id, { archived }))}
        />
      </Card>
    </Screen>
  );
}
