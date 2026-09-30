import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { NameField } from '@/components/manage/NameField';
import { AppText, Card, EmptyState, Screen, ToggleRow } from '@/components/ui';
import { getDb } from '@/db';
import { listActivities } from '@/db/repositories/activities';
import { listGroups, updateGroup } from '@/db/repositories/groups';
import { useManageWrite } from '@/lib/manage/useManageWrite';
import { useQuery } from '@/lib/store/dataVersion';

export default function GroupScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);
  const write = useManageWrite();
  const group = useQuery(() => listGroups(getDb(), { includeArchived: true }).find((candidate) => candidate.id === groupId), [groupId]);
  const count = useQuery(() => listActivities(getDb()).filter((activity) => activity.group_id === groupId).length, [groupId]);

  if (!group) {
    return (
      <Screen back title={t('manage.groups')}>
        <EmptyState icon="help-circle-outline" label={t('manage.gone')} />
      </Screen>
    );
  }

  return (
    <Screen back title={group.name}>
      <Card>
        <NameField key={group.id} label={t('manage.name')} value={group.name} onCommit={(name) => write(() => updateGroup(getDb(), group.id, { name }))} />
        <AppText muted>{t('manage.activityCount', { count })}</AppText>
      </Card>
      <Card>
        <ToggleRow
          label={t('manage.archive')}
          hint={t('manage.archiveGroupHint')}
          value={group.archived}
          onChange={(archived) => write(() => updateGroup(getDb(), group.id, { archived }))}
        />
      </Card>
    </Screen>
  );
}
