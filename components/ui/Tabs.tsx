import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { TOUCH_TARGET, radius, spacing, useTheme, withAlpha } from '@/lib/theme';

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
  const [width, setWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [offset, setOffset] = useState(0);
  // A soft fade at the right edge says there is more to swipe to, as long as the last tab is out of view.
  const more = contentWidth - width - offset > 4;
  return (
    <View style={styles.scroll}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerStyle={styles.row}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentWidth(w)}
        onScroll={(event) => setOffset(event.nativeEvent.contentOffset.x)}
        scrollEventThrottle={32}
      >
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
      {more ? (
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(colors.background, 0), colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fade}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Lets the row run to the screen edges while the first tab still lines up with the title.
  scroll: { marginHorizontal: -spacing.lg, flexGrow: 0 },
  row: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  fade: { position: 'absolute', top: 0, bottom: 0, right: 0, width: spacing.xxl },
  tab: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
