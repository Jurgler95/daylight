import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { MoodLevel } from '@/db/schema';
import { formatPercent, type LevelCount } from '@/lib/insights';
import { radius, spacing, useTheme } from '@/lib/theme';

import { useInspector } from './chart/useInspector';

interface Props {
  label: string;
  levels: LevelCount[];
  moodLabel: (level: MoodLevel) => string;
  /** The label in its own line above the bar, for labels too long for the narrow column in front ("Im Experiment"). */
  labelAbove?: boolean;
}

/**
 * One stacked bar of mood shares with a label in front; spoken as the shares in words. Tapping a
 * part of the bar names its mood with share and days below it.
 */
export function LevelBar({ label, levels, moodLabel, labelAbove = false }: Props) {
  const { t } = useTranslation();
  const { colors, mood: moodColors } = useTheme();
  const [width, setWidth] = useState(0);
  const shown = levels.filter((level) => level.share > 0);
  const total = shown.reduce((sum, level) => sum + level.share, 0);
  const pick = useCallback(
    (x: number) => {
      if (width <= 0 || total <= 0) return null;
      let edge = 0;
      for (let i = 0; i < shown.length; i++) {
        edge += ((shown[i]?.share ?? 0) / total) * width;
        if (x < edge) return i;
      }
      return shown.length - 1;
    },
    [width, total, shown],
  );
  const { selected, responder } = useInspector(pick);
  const picked = selected === null ? undefined : shown[selected];

  const spoken = levels
    .filter((level) => level.days > 0)
    .map((level) => `${moodLabel(level.level)} ${formatPercent(level.share)}`)
    .join(', ');
  const bar = (
    <View
      style={[labelAbove ? styles.barStacked : styles.bar, { backgroundColor: colors.surfaceMuted }]}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      hitSlop={{ top: 10, bottom: 10 }}
      {...responder}
    >
      {shown.map((level, i) => (
        <View
          key={level.level}
          pointerEvents="none"
          style={{ flex: level.share, backgroundColor: moodColors[level.level].strong, opacity: selected === null || selected === i ? 1 : 0.35 }}
        />
      ))}
    </View>
  );
  const detail = picked ? (
    <AppText variant="caption" muted>
      {`${moodLabel(picked.level)} · ${formatPercent(picked.share)} · ${t('insights.days', { count: picked.days })}`}
    </AppText>
  ) : null;

  return (
    <View style={styles.stacked} accessible accessibilityLabel={`${label}: ${spoken}`}>
      {labelAbove ? (
        <>
          <AppText variant="label">{label}</AppText>
          {bar}
          {detail}
        </>
      ) : (
        <>
          <View style={styles.row}>
            <AppText variant="label" style={styles.label}>
              {label}
            </AppText>
            {bar}
          </View>
          {detail ? <View style={styles.indent}>{detail}</View> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 28 },
  // Fits "Después" and "Without" in one line; both rows of a pair share the width, so their bars line up.
  label: { width: 64 },
  indent: { paddingLeft: 64 + spacing.md },
  bar: { flex: 1, flexDirection: 'row', height: 14, borderRadius: radius.pill, overflow: 'hidden' },
  stacked: { gap: spacing.xs },
  barStacked: { flexDirection: 'row', height: 14, borderRadius: radius.pill, overflow: 'hidden' },
});
