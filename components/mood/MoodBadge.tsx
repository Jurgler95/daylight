import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import type { MoodLevel } from '@/db/schema';
import type { IconName } from '@/lib/icons';
import { moodColors, useTheme } from '@/lib/theme';

interface Props {
  level: MoodLevel;
  icon: IconName;
  size?: number;
  /** Filled with the strong colour and a white icon, for the picked mood. */
  filled?: boolean;
}

/** A mood as a round badge: soft colour behind the icon in the strong one. Decorative for screen readers. */
export function MoodBadge({ level, icon, size = 40, filled }: Props) {
  const { colors } = useTheme();
  const { strong, soft } = moodColors[level];
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: filled ? strong : soft }]}
    >
      <MaterialCommunityIcons name={icon} size={Math.round(size * 0.62)} color={filled ? colors.textOnAccent : strong} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
});
