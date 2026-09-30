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

/** The two ranges on offer: a short one like Daylio's, and the 0 to 10 Zyklus uses. */
const RANGES = [
  { key: '1-5', min: 1, max: 5 },
  { key: '0-10', min: 0, max: 10 },
] as const;

type RangeKey = (typeof RANGES)[number]['key'];

/** Own values like energy or stress. Each appears in the editor below the activities. */
export default function ScalesScreen() {
  const { t } = useTranslation();
  const write = useManageWrite();
  const [range, setRange] = useState<RangeKey>('1-5');
  const all = useQuery(() => listScales(getDb(), { includeArchived: true }), []);
  const active = all.filter((scale) => !scale.archived);
  const archived = all.filter((scale) => scale.archived);
  const open = (id: number) => router.push({ pathname: '/more/scale/[id]', params: { id: String(id) } });
  const row = (scale: Scale) => (
    <ManageRow key={scale.id} label={scale.name} meta={t('manage.range', { min: scale.min, max: scale.max })} onPress={() => open(scale.id)} />
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
          options={RANGES.map((option) => ({ value: option.key, label: t('manage.range', { min: option.min, max: option.max }) }))}
          value={range}
          onChange={setRange}
        />
        <AddRow
          placeholder={t('manage.newScale')}
          addLabel={t('manage.add')}
          onAdd={(name) => {
            const { min, max } = RANGES.find((option) => option.key === range) ?? RANGES[0];
            return write(() => createScale(getDb(), { name, min, max }));
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
