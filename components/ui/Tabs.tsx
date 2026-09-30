import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { haptics } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';

interface Tab<T> {
  value: T;
  label: string;
  icon: IconName;
}

interface Props<T> {
  tabs: readonly Tab<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * A row of sections that scrolls sideways once it no longer fits. Unlike `Segmented`, which
 * switches how the same content is shown, each tab shows different content.
 */
export function Tabs<T extends string>({ tabs, value, onChange }: Props<T>) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={styles.row} style={styles.scroll}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        const tint = selected ? colors.accent : colors.textMuted;
        return (
          <Pressable
            key={tab.value}
            onPress={() => {
              if (selected) return;
              haptics.tick();
              onChange(tab.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            style={({ pressed }) => [
              styles.tab,
              { backgroundColor: selected ? colors.accentSoft : 'transparent', opacity: pressed && !selected ? 0.6 : 1 },
            ]}
          >
            <MaterialCommunityIcons name={tab.icon} size={18} color={tint} />
            <AppText variant="label" color={selected ? colors.accent : colors.text}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Lets the row run to the screen edges while the first tab still lines up with the title.
  scroll: { marginHorizontal: -spacing.lg, flexGrow: 0 },
  row: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  tab: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
