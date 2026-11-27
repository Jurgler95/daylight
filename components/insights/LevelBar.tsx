import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { MoodLevel } from '@/db/schema';
import { formatPercent, type LevelCount } from '@/lib/insights';
import { radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  label: string;
  levels: LevelCount[];
  moodLabel: (level: MoodLevel) => string;
  /** The label in its own line above the bar, for labels too long for the narrow column in front ("Im Experiment"). */
  labelAbove?: boolean;
}

/** One stacked bar of mood shares with a label in front; spoken as the shares in words. */
export function LevelBar({ label, levels, moodLabel, labelAbove = false }: Props) {
  const { colors, mood: moodColors } = useTheme();
  const spoken = levels
    .filter((level) => level.days > 0)
    .map((level) => `${moodLabel(level.level)} ${formatPercent(level.share)}`)
    .join(', ');
  return (
    <View style={labelAbove ? styles.stacked : styles.row} accessible accessibilityLabel={`${label}: ${spoken}`}>
      <AppText variant="label" style={labelAbove ? null : styles.label}>
        {label}
      </AppText>
      <View style={[labelAbove ? styles.barStacked : styles.bar, { backgroundColor: colors.surfaceMuted }]}>
        {levels.map((level) => (level.share > 0 ? <View key={level.level} style={{ flex: level.share, backgroundColor: moodColors[level.level].strong }} /> : null))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 28 },
  // Fits "Después" and "Without" in one line; both rows of a pair share the width, so their bars line up.
  label: { width: 64 },
  bar: { flex: 1, flexDirection: 'row', height: 14, borderRadius: radius.pill, overflow: 'hidden' },
  stacked: { gap: spacing.xs },
  barStacked: { flexDirection: 'row', height: 14, borderRadius: radius.pill, overflow: 'hidden' },
});
