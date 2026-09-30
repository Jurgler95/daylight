import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { IconPicker } from '@/components/manage/IconPicker';
import { NameField } from '@/components/manage/NameField';
import { AppText, Button, Card, EmptyState, Screen, SelectRow, ToggleRow } from '@/components/ui';
import { getDb } from '@/db';
import { activityUsage, getActivity, listActivities, mergeActivities, updateActivity } from '@/db/repositories/activities';
import { listGroups } from '@/db/repositories/groups';
import type { IconName } from '@/lib/icons';
import { useManageWrite } from '@/lib/manage/useManageWrite';
import { useQuery } from '@/lib/store/dataVersion';

export default function ActivityScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const activityId = Number(id);
  const write = useManageWrite();
  const activity = useQuery(() => getActivity(getDb(), activityId), [activityId]);
  const groups = useQuery(() => listGroups(getDb()), []);
  const others = useQuery(() => listActivities(getDb(), { includeArchived: true }).filter((other) => other.id !== activityId), [activityId]);
  const usage = useQuery(() => activityUsage(getDb()), []);

  if (!activity) {
    return (
      <Screen back title={t('manage.activities')}>
        <EmptyState icon="help-circle-outline" label={t('manage.gone')} />
      </Screen>
    );
  }
  const uses = usage.get(activity.id) ?? 0;

  // Grouped like the editor, so a duplicate is found where it lives.
  const mergeSections = groups
    .map((group) => ({
      title: group.name,
      options: others
        .filter((other) => other.group_id === group.id)
        .map((other) => ({ value: String(other.id), label: other.name, hint: t('manage.usage', { count: usage.get(other.id) ?? 0 }) })),
    }))
    .filter((section) => section.options.length > 0);

  const merge = (value: string) => {
    const target = others.find((other) => String(other.id) === value);
    if (!target) return;
    Alert.alert(
      t('manage.mergeTitle', { from: activity.name, into: target.name }),
      t('manage.mergeBody', { count: uses, from: activity.name, into: target.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('manage.merge'),
          style: 'destructive',
          onPress: () => {
            if (write(() => mergeActivities(getDb(), activity.id, target.id))) {
              router.replace({ pathname: '/more/activity/[id]', params: { id: String(target.id) } });
            }
          },
        },
      ],
    );
  };

  return (
    <Screen back title={activity.name}>
      <Card>
        <AppText muted>{t('manage.usage', { count: uses })}</AppText>
        {uses > 0 ? (
          <Button variant="secondary" label={t('insights.activity.insights')} onPress={() => router.push({ pathname: '/activity/[id]', params: { id: String(activity.id) } })} />
        ) : null}
        <NameField key={activity.id} label={t('manage.name')} value={activity.name} onCommit={(name) => write(() => updateActivity(getDb(), activity.id, { name }))} />
        <IconPicker value={activity.icon as IconName} onChange={(icon) => write(() => updateActivity(getDb(), activity.id, { icon }))} />
        <SelectRow
          label={t('manage.group')}
          value={String(activity.group_id)}
          sections={[{ options: groups.map((group) => ({ value: String(group.id), label: group.name })) }]}
          closeLabel={t('common.close')}
          onChange={(value) => write(() => updateActivity(getDb(), activity.id, { group_id: Number(value) }))}
        />
      </Card>
      {mergeSections.length > 0 ? (
        <Card>
          <SelectRow
            label={t('manage.mergeWith')}
            value=""
            placeholder={t('manage.mergeChoose')}
            title={t('manage.mergeSheet', { name: activity.name })}
            sections={mergeSections}
            closeLabel={t('common.close')}
            onChange={merge}
          />
        </Card>
      ) : null}
      <Card>
        <ToggleRow
          label={t('manage.archive')}
          hint={t('manage.archiveActivityHint')}
          value={activity.archived}
          onChange={(archived) => write(() => updateActivity(getDb(), activity.id, { archived }))}
        />
      </Card>
    </Screen>
  );
}
