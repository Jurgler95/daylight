import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MANAGE_ROW_HEIGHT, ManageRow } from '@/components/manage/ManageRow';
import { SortableList } from '@/components/manage/SortableList';
import { Card, Screen } from '@/components/ui';
import { getDb } from '@/db';
import { listActivities } from '@/db/repositories/activities';
import { listGroups, reorderGroups } from '@/db/repositories/groups';
import { useManageWrite } from '@/lib/manage/useManageWrite';
import { useQuery } from '@/lib/store/dataVersion';

/** The order of the groups in the editor, the Daylio export and every list of activities. */
export default function GroupsScreen() {
  const { t } = useTranslation();
  const write = useManageWrite();
  const groups = useQuery(() => listGroups(getDb()), []);
  const counts = useQuery(() => {
    const map = new Map<number, number>();
    for (const activity of listActivities(getDb())) map.set(activity.group_id, (map.get(activity.group_id) ?? 0) + 1);
    return map;
  }, []);

  return (
    <Screen back title={t('manage.groups')}>
      <Card>
        <SortableList
          items={groups}
          keyOf={(group) => group.id}
          rowHeight={MANAGE_ROW_HEIGHT}
          renderRow={(group) => (
            <ManageRow
              label={group.name}
              meta={t('manage.activityCount', { count: counts.get(group.id) ?? 0 })}
              onPress={() => router.push({ pathname: '/more/group/[id]', params: { id: String(group.id) } })}
            />
          )}
          onReorder={(ids) => write(() => reorderGroups(getDb(), ids))}
          handleLabel={(group) => t('manage.moveHandle', { name: group.name })}
          moveUpLabel={t('manage.moveUp')}
          moveDownLabel={t('manage.moveDown')}
        />
      </Card>
    </Screen>
  );
}
