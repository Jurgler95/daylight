import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AddRow } from '@/components/manage/AddRow';
import { MANAGE_ROW_HEIGHT, ManageRow } from '@/components/manage/ManageRow';
import { SortableList } from '@/components/manage/SortableList';
import { AppText, Card, Screen, Segmented } from '@/components/ui';
import { getDb } from '@/db';
import { writeOrder } from '@/db/repositories/order';
import { createScale, listScales } from '@/db/repositories/scales';
import { scales as scalesTable, type Scale } from '@/db/schema';
import { useManageWrite } from '@/lib/manage/useManageWrite';
import { useQuery } from '@/lib/store/dataVersion';

/** What a new scale can be: a short rating like Daylio's, the 0 to 10 Zyklus uses, or hours and minutes. */
const KINDS = [
  { key: '1-5', kind: 'rating', min: 1, max: 5 },
  { key: '0-10', kind: 'rating', min: 0, max: 10 },
  { key: 'duration', kind: 'duration', min: 0, max: 0 },
] as const;

type KindKey = (typeof KINDS)[number]['key'];

/** Own values like energy or stress. Each appears in the editor below the activities. */
export default function ScalesScreen() {
  const { t } = useTranslation();
  const write = useManageWrite();
  const [choice, setChoice] = useState<KindKey>('1-5');
  const all = useQuery(() => listScales(getDb(), { includeArchived: true }), []);
  const active = all.filter((scale) => !scale.archived);
  const archived = all.filter((scale) => scale.archived);
  const scaleMeta = (scale: Scale) => (scale.kind === 'duration' ? t('manage.duration') : t('manage.range', { min: scale.min, max: scale.max }));
  const open = (id: number) => router.push({ pathname: '/more/scale/[id]', params: { id: String(id) } });
  const row = (scale: Scale) => (
    <ManageRow key={scale.id} label={scale.name} meta={scaleMeta(scale)} onPress={() => open(scale.id)} />
  );

  return (
    <Screen back title={t('manage.scales')}>
      <Card>
        <SortableList
          items={active}
          keyOf={(scale) => scale.id}
          rowHeight={MANAGE_ROW_HEIGHT}
          renderRow={row}
          onReorder={(ids) => write(() => writeOrder(getDb(), scalesTable, ids))}
          handleLabel={(scale) => t('manage.moveHandle', { name: scale.name })}
          moveUpLabel={t('manage.moveUp')}
          moveDownLabel={t('manage.moveDown')}
        />
        <Segmented
          label={t('manage.newScaleRange')}
          options={KINDS.map((option) => ({
            value: option.key,
            label: option.kind === 'duration' ? t('manage.duration') : t('manage.range', { min: option.min, max: option.max }),
          }))}
          value={choice}
          onChange={setChoice}
        />
        <AddRow
          placeholder={t('manage.newScale')}
          addLabel={t('manage.add')}
          onAdd={(name) => {
            const { kind, min, max } = KINDS.find((option) => option.key === choice) ?? KINDS[0];
            return write(() => createScale(getDb(), { name, kind, min, max }));
          }}
        />
      </Card>
      {archived.length > 0 ? (
        <Card tone="muted">
          <AppText variant="caption" muted>
            {t('manage.archived').toUpperCase()}
          </AppText>
          {archived.map(row)}
        </Card>
      ) : null}
    </Screen>
  );
}
