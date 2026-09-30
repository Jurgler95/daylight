import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ActivityGroupCard } from '@/components/entry/ActivityGroupCard';
import { AppText, Card } from '@/components/ui';
import { getDb } from '@/db';
import { listPlannedActivities, setPlannedActivities } from '@/db/repositories/plans';
import { editorGroups, type Catalog } from '@/lib/catalog/catalog';
import type { DateString } from '@/lib/dates';
import { mutate, useQuery } from '@/lib/store/dataVersion';

/**
 * Plans for a future day, with the same chips as the entry editor. Every tap writes at once:
 * a plan has no "save", and nothing is lost when the day is left.
 */
export function PlanCards({ date, catalog }: { date: DateString; catalog: Catalog }) {
  const { t } = useTranslation();
  const planned = useQuery(() => listPlannedActivities(getDb(), date, date).map((row) => row.activity_id), [date]);
  const groups = editorGroups(catalog, planned);
  // Groups start folded unless they already hold a plan; `flipped` are the ones the user turned.
  const [flipped, setFlipped] = useState<number[]>([]);
  const toggle = (id: number) => {
    const next = planned.includes(id) ? planned.filter((x) => x !== id) : [...planned, id];
    mutate(() => setPlannedActivities(getDb(), date, next));
  };

  if (!groups.some((group) => group.activities.length)) return null;
  return (
    <>
      <AppText variant="caption" muted>
        {t('today.planned').toUpperCase()}
      </AppText>
      {groups
        .filter((group) => group.activities.length)
        .map((item) => {
          const hasPlan = item.activities.some((activity) => planned.includes(activity.id));
          const collapsed = !hasPlan !== flipped.includes(item.group.id);
          return (
            <ActivityGroupCard
              key={item.group.id}
              item={item}
              selected={planned}
              collapsed={collapsed}
              selectedLabel={(count) => t('entry.selected', { count })}
              onToggleCollapsed={() => setFlipped((list) => (list.includes(item.group.id) ? list.filter((id) => id !== item.group.id) : [...list, item.group.id]))}
              onToggle={toggle}
            />
          );
        })}
      {planned.length === 0 ? (
        <Card tone="muted">
          <AppText muted>{t('today.plannedHint')}</AppText>
        </Card>
      ) : null}
    </>
  );
}
