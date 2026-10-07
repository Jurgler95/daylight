import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { MOOD_LEVELS, type MoodLevel } from '@/db/schema';
import { daysBetween, formatShort, type DateString } from '@/lib/dates';
import { formatDecimal, ROLLING_DAYS, windowLength, type DayWindow, type MoodPoint } from '@/lib/insights';
import type { IconName } from '@/lib/icons';
import { roundLevel } from '@/lib/mood/dayMood';
import { moodColors, spacing, useTheme } from '@/lib/theme';

interface Props {
  points: MoodPoint[];
  window: DayWindow;
  mean: number | null;
  iconFor: (level: MoodLevel) => IconName;
  /** Turning points inside the window, drawn as dashed lines with a flag on top. */
  marks?: readonly DateString[];
}

const HEIGHT = 150;
const AXIS = 26;
const PAD = 8;

/**
 * Day means as dots in their mood colour, the 7-day mean as a line. Drawn with plain SVG: a year
 * has 365 dots, which as one path per level stays cheap where a chart library would draw a
 * component per point. The line breaks where a gap is longer than its own week.
 */
export function MoodLineChart({ points, window, mean, iconFor, marks = [] }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const plotWidth = Math.max(0, width - AXIS - PAD * 2);
  const plotHeight = HEIGHT - PAD * 2;
  const span = Math.max(1, windowLength(window) - 1);
  const x = (date: MoodPoint['date']) => AXIS + PAD + (daysBetween(window.from, date) / span) * plotWidth;
  const y = (value: number) => PAD + ((5 - value) / 4) * plotHeight;
  const dot = span > 120 ? 4 : span > 40 ? 6 : 8;

  const dots = new Map<MoodLevel, string>();
  for (const point of points) {
    const level = roundLevel(point.mean);
    dots.set(level, `${dots.get(level) ?? ''}M${x(point.date).toFixed(1)} ${y(point.mean).toFixed(1)}h0.01`);
  }
  let line = '';
  points.forEach((point, i) => {
    const previous = points[i - 1];
    const jump = !previous || daysBetween(previous.date, point.date) > ROLLING_DAYS;
    line += `${jump ? 'M' : 'L'}${x(point.date).toFixed(1)} ${y(point.rolling).toFixed(1)}`;
  });
  const shownMarks = marks.filter((date) => date >= window.from && date <= window.to);
  const last = points[points.length - 1];
  const label = t('insights.trend.a11y', {
    from: formatShort(window.from),
    to: formatShort(window.to),
    count: points.length,
    mean: mean === null ? '' : formatDecimal(mean),
    last: last ? formatDecimal(last.rolling) : '',
  });

  return (
    <View style={styles.wrap}>
      <View accessible accessibilityRole="image" accessibilityLabel={label} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))} style={styles.plot}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            {MOOD_LEVELS.map((level) => (
              <Line key={level} x1={AXIS} x2={width} y1={y(level)} y2={y(level)} stroke={colors.border} strokeWidth={1} />
            ))}
            {[...dots.entries()].map(([level, d]) => (
              <Path key={level} d={d} stroke={moodColors[level].strong} strokeWidth={dot} strokeLinecap="round" opacity={0.55} />
            ))}
            {shownMarks.map((date) => (
              <Line key={date} x1={x(date)} x2={x(date)} y1={PAD + 6} y2={HEIGHT - PAD} stroke={colors.accent} strokeWidth={1.5} strokeDasharray="4 3" />
            ))}
            <Path d={line} stroke={colors.text} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          </Svg>
        ) : null}
        {width > 0
          ? shownMarks.map((date) => (
              <View key={date} style={[styles.flag, { left: x(date) - 7 }]}>
                <MaterialCommunityIcons name="flag-variant" size={14} color={colors.accent} />
              </View>
            ))
          : null}
        {MOOD_LEVELS.map((level) => (
          <View key={level} style={[styles.icon, { top: y(level) - 9 }]}>
            <MaterialCommunityIcons name={iconFor(level)} size={18} color={moodColors[level].strong} />
          </View>
        ))}
      </View>
      <View style={[styles.axis, { paddingLeft: AXIS }]}>
        <AppText variant="caption" muted>
          {formatShort(window.from)}
        </AppText>
        <AppText variant="caption" muted>
          {formatShort(window.to)}
        </AppText>
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: moodColors[4].strong }]} />
          <AppText variant="caption" muted>
            {t('insights.trend.day')}
          </AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: colors.text }]} />
          <AppText variant="caption" muted>
            {t('insights.trend.week')}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  plot: { height: HEIGHT },
  icon: { position: 'absolute', left: 0 },
  flag: { position: 'absolute', top: -6 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  legend: { flexDirection: 'row', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLine: { width: 14, height: 2, borderRadius: 1 },
});
