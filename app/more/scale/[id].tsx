import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { NameField } from '@/components/manage/NameField';
import { NumberSettings } from '@/components/manage/NumberSettings';
import { useCommitOnUnmount } from '@/components/manage/useCommitOnUnmount';
import { AppText, Button, Card, EmptyState, Screen, ToggleRow } from '@/components/ui';
import { getDb } from '@/db';
import { listScales, updateScale } from '@/db/repositories/scales';
import type { Scale } from '@/db/schema';
import { useManageWrite } from '@/lib/manage/useManageWrite';
import { useQuery } from '@/lib/store/dataVersion';

/** The unit saves when its field is left (or the screen closes while typing), decimals at once. */
function ScaleNumberSettings({ scale, onSave }: { scale: Scale; onSave: (patch: Partial<Pick<Scale, 'unit' | 'decimals'>>) => boolean }) {
  const [unit, setUnit] = useState(scale.unit);
  const commit = () => {
    if (unit.trim() !== scale.unit && !onSave({ unit })) setUnit(scale.unit);
  };
  useCommitOnUnmount(commit);
  return <NumberSettings unit={unit} decimals={scale.decimals} onUnit={setUnit} onUnitBlur={commit} onDecimals={(decimals) => onSave({ decimals })} />;
}

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
        <AppText muted>
          {scale.kind === 'duration' ? t('manage.durationHint') : scale.kind === 'number' ? t('manage.numberHint') : t('manage.range', { min: scale.min, max: scale.max })}
        </AppText>
        {scale.kind === 'number' ? (
          <ScaleNumberSettings key={scale.id} scale={scale} onSave={(patch) => write(() => updateScale(getDb(), scale.id, patch))} />
        ) : null}
        <Button
          variant="secondary"
          label={t('manage.scaleInsights')}
          onPress={() => router.navigate({ pathname: '/insights', params: { section: 'scales', scale: String(scale.id) } })}
        />
      </Card>
      <Card>
        <ToggleRow
          label={t('manage.describesMood')}
          hint={t('manage.describesMoodScaleHint')}
          value={scale.describes_mood}
          onChange={(describes_mood) => write(() => updateScale(getDb(), scale.id, { describes_mood }))}
        />
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
