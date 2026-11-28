import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { spacing, useTheme } from '@/lib/theme';

import { ChartTooltip } from './chart/ChartTooltip';
import { useInspector } from './chart/useInspector';

interface Props {
  /** One per bar, 0..1 of the plot height. */
  values: number[];
  /** Under each bar; empty strings keep the slot. */
  labels: string[];
  /** Shown when a bar is tapped, one per bar: "Mo: 12 Tage". Without it the bars do not react. */
  details?: string[];
  /** Everything a screen reader needs, since the bars themselves are silent. */
  accessibilityLabel: string;
  height?: number;
}

/** Small vertical bars without axes, for counts per weekday, month or hour. Tapping a bar shows its value. */
export function MiniBars({ values, labels, details, accessibilityLabel, height = 64 }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const pick = useCallback(
    (x: number) => (details && width > 0 && values.length > 0 ? Math.max(0, Math.min(values.length - 1, Math.floor((x / width) * values.length))) : null),
    [details, width, values.length],
  );
  const { selected, responder } = useInspector(pick);
  const detail = selected === null ? undefined : details?.[selected];
  const slot = values.length > 0 ? width / values.length : 0;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.wrap}>
      <View style={[styles.bars, { height }]} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))} {...(details ? responder : {})}>
        {values.map((value, i) => (
          <View key={i} style={styles.slot} pointerEvents="none">
            <View
              style={[
                styles.bar,
                {
                  height: `${Math.max(0, Math.min(1, value)) * 100}%`,
                  backgroundColor: value > 0 ? colors.accent : colors.surfaceMuted,
                  opacity: selected === null || selected === i ? 1 : 0.4,
                },
              ]}
            />
          </View>
        ))}
        {detail && selected !== null ? (
          <ChartTooltip x={slot * (selected + 0.5)} width={width}>
            <AppText variant="caption">{detail}</AppText>
          </ChartTooltip>
        ) : null}
      </View>
      {labels.length > 0 ? (
        <View style={styles.labels}>
          {labels.map((label, i) => (
            <AppText key={i} variant="caption" muted style={styles.label} numberOfLines={1}>
              {label}
            </AppText>
          ))}
        </View>
      ) : null}
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
