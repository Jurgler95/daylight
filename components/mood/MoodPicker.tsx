import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import type { Mood, MoodLevel } from '@/db/schema';
import { haptics } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { TOUCH_TARGET, moodColors, spacing, useTheme } from '@/lib/theme';

import { MoodBadge } from './MoodBadge';

interface Props {
  moods: readonly Mood[];
  selected?: number | null;
  onPick: (moodId: number) => void;
  /** Badge diameter; the Today card uses a larger one than the editor. */
  size?: number;
}

/** The five moods in one row, best first. Tapping one picks it; the icon and name carry the meaning. */
export function MoodPicker({ moods, selected = null, onPick, size = 52 }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {moods.map((mood) => {
        const level = mood.level as MoodLevel;
        const active = mood.id === selected;
        return (
          <PressableScale
            key={mood.id}
            pressedScale={0.9}
            onPress={() => {
              haptics.on();
              onPick(mood.id);
            }}
            accessibilityRole="radio"
            accessibilityLabel={mood.label}
            accessibilityState={{ selected: active }}
            style={styles.item}
          >
            <MoodBadge level={level} icon={mood.icon as IconName} size={size} filled={active} />
            <AppText variant="caption" numberOfLines={1} color={active ? moodColors[level].strong : colors.textMuted}>
              {mood.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  // Always five, sharing the width evenly, so they fit one line on any phone.
  item: { flex: 1, minWidth: 0, minHeight: TOUCH_TARGET, alignItems: 'center', gap: spacing.xs },
});
