import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { MoodLevel } from '@/db/schema';
import { formatPercent, type LevelCount } from '@/lib/insights';
import { moodColors, radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  label: string;
  levels: LevelCount[];
  moodLabel: (level: MoodLevel) => string;
}

/** One stacked bar of mood shares with a label in front; spoken as the shares in words. */
export function LevelBar({ label, levels, moodLabel }: Props) {
  const { colors } = useTheme();
  const spoken = levels
    .filter((level) => level.days > 0)
    .map((level) => `${moodLabel(level.level)} ${formatPercent(level.share)}`)
    .join(', ');
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${spoken}`}>
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>
      <View style={[styles.bar, { backgroundColor: colors.surfaceMuted }]}>
        {levels.map((level) => (level.share > 0 ? <View key={level.level} style={{ flex: level.share, backgroundColor: moodColors[level.level].strong }} /> : null))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 28 },
  label: { width: 44 },
  bar: { flex: 1, flexDirection: 'row', height: 14, borderRadius: radius.pill, overflow: 'hidden' },
});
