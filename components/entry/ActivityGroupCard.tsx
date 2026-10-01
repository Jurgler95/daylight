import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Card, Chip } from '@/components/ui';
import type { GroupWithActivities } from '@/lib/catalog/catalog';
import { haptics } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  item: GroupWithActivities;
  selected: readonly number[];
  collapsed: boolean;
  /** "2 gewählt", read out and shown while the group is folded. */
  selectedLabel: (count: number) => string;
  onToggleCollapsed: () => void;
  onToggle: (activityId: number) => void;
  /** Placeholder of the name field behind the plus chip, also its accessibility label. */
  addLabel?: string;
  /** Creates an activity in this group; returns whether it worked, the field closes only then. Without it, no plus chip. */
  onAdd?: (name: string) => boolean;
}

/**
 * One activity group in the editor: a header that folds it, then its activities as chips and a plus
 * chip that turns into a name field, so a missing activity is added without leaving the entry.
 */
export function ActivityGroupCard({ item, selected, collapsed, selectedLabel, onToggleCollapsed, onToggle, addLabel, onAdd }: Props) {
  const { colors } = useTheme();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const close = () => {
    setAdding(false);
    setText('');
  };
  const add = () => {
    const name = text.trim();
    if (!name) return close();
    if (onAdd?.(name)) close();
  };
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
          {!onAdd ? null : adding ? (
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={add}
              onBlur={() => {
                if (!text.trim()) close();
              }}
              autoFocus
              placeholder={addLabel}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={addLabel}
              returnKeyType="done"
              style={[styles.input, { borderColor: colors.accent, color: colors.text }]}
            />
          ) : (
            <Pressable
              onPress={() => {
                haptics.tick();
                setAdding(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={addLabel}
              style={({ pressed }) => [styles.add, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="add" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: TOUCH_TARGET },
  title: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  add: { minWidth: TOUCH_TARGET, height: TOUCH_TARGET, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  input: { minWidth: 160, height: TOUCH_TARGET, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.lg, fontSize: 16 },
});
