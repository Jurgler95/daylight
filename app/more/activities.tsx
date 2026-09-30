import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AddRow } from '@/components/manage/AddRow';
import { MANAGE_ROW_HEIGHT, ManageRow } from '@/components/manage/ManageRow';
import { SortableList } from '@/components/manage/SortableList';
import { AppText, Card, ListRow, Screen } from '@/components/ui';
import { getDb } from '@/db';
import { activityUsage, createActivity, listActivities, reorderActivities } from '@/db/repositories/activities';
import { createGroup, listGroups } from '@/db/repositories/groups';
import type { Activity } from '@/db/schema';
import type { IconName } from '@/lib/icons';
import { useManageWrite } from '@/lib/manage/useManageWrite';
import { useQuery } from '@/lib/store/dataVersion';
import { TOUCH_TARGET, spacing, useTheme } from '@/lib/theme';

/**
 * Every group with its activities in editor order. Hold the handle to reorder inside a group;
 * moving to another group, merging and archiving happen on the activity's own page.
 */
export default function ActivitiesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const write = useManageWrite();
  const groups = useQuery(() => listGroups(getDb(), { includeArchived: true }), []);
  const activities = useQuery(() => listActivities(getDb(), { includeArchived: true }), []);
  const usage = useQuery(() => activityUsage(getDb()), []);
  const open = (id: number) => router.push({ pathname: '/more/activity/[id]', params: { id: String(id) } });
  const meta = (activity: Activity) => t('manage.usage', { count: usage.get(activity.id) ?? 0 });

  const activeGroups = groups.filter((group) => !group.archived);
  const archivedGroups = groups.filter((group) => group.archived);
  const archivedActivities = activities.filter((activity) => activity.archived || archivedGroups.some((group) => group.id === activity.group_id));

  return (
    <Screen back title={t('manage.activities')}>
      {activeGroups.map((group) => {
        const items = activities.filter((activity) => activity.group_id === group.id && !activity.archived);
        return (
          <Card key={group.id}>
            <View style={styles.groupHead}>
              <AppText variant="headline" style={styles.flex}>
                {group.name}
              </AppText>
              <Pressable
                onPress={() => router.push({ pathname: '/more/group/[id]', params: { id: String(group.id) } })}
                accessibilityRole="button"
                accessibilityLabel={t('manage.editGroup', { name: group.name })}
                style={({ pressed }) => [styles.edit, { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="create-outline" size={20} color={colors.text} />
              </Pressable>
            </View>
            <SortableList
              items={items}
              keyOf={(activity) => activity.id}
              rowHeight={MANAGE_ROW_HEIGHT}
              renderRow={(activity) => <ManageRow icon={activity.icon as IconName} label={activity.name} meta={meta(activity)} onPress={() => open(activity.id)} />}
              onReorder={(ids) => write(() => reorderActivities(getDb(), ids))}
              handleLabel={(activity) => t('manage.moveHandle', { name: activity.name })}
              moveUpLabel={t('manage.moveUp')}
              moveDownLabel={t('manage.moveDown')}
            />
            <AddRow
              placeholder={t('manage.newActivity')}
              addLabel={t('manage.add')}
              onAdd={(name) => write(() => createActivity(getDb(), { group_id: group.id, name }))}
            />
          </Card>
        );
      })}

      <Card>
        <AddRow placeholder={t('manage.newGroup')} addLabel={t('manage.add')} onAdd={(name) => write(() => createGroup(getDb(), name))} />
        <ListRow icon="swap-vertical-outline" label={t('manage.sortGroups')} onPress={() => router.push('/more/groups')} />
      </Card>

      {archivedActivities.length > 0 || archivedGroups.length > 0 ? (
        <Card tone="muted">
          <AppText variant="caption" muted>
            {t('manage.archived').toUpperCase()}
          </AppText>
          {archivedGroups.map((group) => (
            <ManageRow
              key={`group-${group.id}`}
              label={group.name}
              meta={t('manage.group')}
              onPress={() => router.push({ pathname: '/more/group/[id]', params: { id: String(group.id) } })}
            />
          ))}
          {archivedActivities.map((activity) => (
            <ManageRow key={activity.id} icon={activity.icon as IconName} label={activity.name} meta={meta(activity)} onPress={() => open(activity.id)} />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  edit: { width: TOUCH_TARGET, height: TOUCH_TARGET, borderRadius: TOUCH_TARGET / 2, alignItems: 'center', justifyContent: 'center' },
});
