import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, Chip } from '@/components/ui';
import type { GroupWithActivities } from '@/lib/catalog/catalog';
import { haptics } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { TOUCH_TARGET, spacing, useTheme } from '@/lib/theme';

interface Props {
  item: GroupWithActivities;
  selected: readonly number[];
  collapsed: boolean;
  /** "2 gewählt", read out and shown while the group is folded. */
  selectedLabel: (count: number) => string;
  onToggleCollapsed: () => void;
  onToggle: (activityId: number) => void;
}

/** One activity group in the editor: a header that folds it, then its activities as chips. */
export function ActivityGroupCard({ item, selected, collapsed, selectedLabel, onToggleCollapsed, onToggle }: Props) {
  const { colors } = useTheme();
  const count = item.activities.filter((activity) => selected.includes(activity.id)).length;
  return (
    <Card>
      <Pressable
        onPress={() => {
          haptics.tick();
          onToggleCollapsed();
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={count > 0 ? `${item.group.name}, ${selectedLabel(count)}` : item.group.name}
        style={({ pressed }) => [styles.header, { opacity: pressed ? 0.6 : 1 }]}
      >
        <AppText variant="headline" style={styles.title}>
          {item.group.name}
        </AppText>
        {count > 0 ? (
          <AppText variant="label" color={colors.accent}>
            {selectedLabel(count)}
          </AppText>
        ) : null}
        <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={20} color={colors.textMuted} />
      </Pressable>
      {collapsed ? null : (
        <View style={styles.chips}>
          {item.activities.map((activity) => (
            <Chip
              key={activity.id}
              label={activity.name}
              icon={activity.icon as IconName}
              selected={selected.includes(activity.id)}
              onPress={() => onToggle(activity.id)}
            />
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: TOUCH_TARGET },
  title: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
