import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { spacing, useTheme } from '@/lib/theme';

interface Props {
  /** One per bar, 0..1 of the plot height. */
  values: number[];
  /** Under each bar; empty strings keep the slot. */
  labels: string[];
  /** Everything a screen reader needs, since the bars themselves are silent. */
  accessibilityLabel: string;
  height?: number;
}

/** Small vertical bars without axes, for counts per weekday or month on a detail page. */
export function MiniBars({ values, labels, accessibilityLabel, height = 64 }: Props) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.wrap}>
      <View style={[styles.bars, { height }]}>
        {values.map((value, i) => (
          <View key={i} style={styles.slot}>
            <View style={[styles.bar, { height: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: value > 0 ? colors.accent : colors.surfaceMuted }]} />
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {labels.map((label, i) => (
          <AppText key={i} variant="caption" muted style={styles.label} numberOfLines={1}>
            {label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 3, minHeight: 2 },
  labels: { flexDirection: 'row', gap: 3 },
  label: { flex: 1, textAlign: 'center' },
});
