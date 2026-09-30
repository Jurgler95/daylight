import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { daysBetween, formatShort } from '@/lib/dates';
import { formatMetric } from '@/lib/health/format';
import { ROLLING_DAYS, windowLength, type DayWindow, type HealthMetric, type HealthPoint } from '@/lib/insights';
import { spacing, useTheme } from '@/lib/theme';

interface Props {
  metric: HealthMetric;
  points: HealthPoint[];
  window: DayWindow;
  /** Drawn as a dashed line, e.g. 7 h of sleep. */
  goal?: number;
}

const HEIGHT = 140;
const AXIS = 52;
const PAD = 8;

/**
 * Day values as dots, the 7-day mean as a line, like the mood trend. Steps, sleep and training
 * start at 0; the pulse only moves a few beats, so its scale hugs the values.
 */
export function HealthLineChart({ metric, points, window, goal }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const values = points.map((p) => p.value);
  const max = Math.max(goal ?? 0, ...values);
  const min = Math.min(...values);
  const lo = metric === 'restingHr' ? Math.max(0, Math.floor(min) - 3) : 0;
  const hi = metric === 'restingHr' ? Math.ceil(max) + 3 : Math.max(1, max * 1.05);
  const plotWidth = Math.max(0, width - AXIS - PAD * 2);
  const plotHeight = HEIGHT - PAD * 2;
  const span = Math.max(1, windowLength(window) - 1);
  const x = (date: HealthPoint['date']) => AXIS + PAD + (daysBetween(window.from, date) / span) * plotWidth;
  const y = (value: number) => PAD + ((hi - value) / (hi - lo)) * plotHeight;
  const dot = span > 120 ? 4 : span > 40 ? 6 : 8;

  let dots = '';
  let line = '';
  points.forEach((point, i) => {
    dots += `M${x(point.date).toFixed(1)} ${y(point.value).toFixed(1)}h0.01`;
    const previous = points[i - 1];
    const jump = !previous || daysBetween(previous.date, point.date) > ROLLING_DAYS;
    line += `${jump ? 'M' : 'L'}${x(point.date).toFixed(1)} ${y(point.rolling).toFixed(1)}`;
  });
  const last = points[points.length - 1];
  const label = t('insights.healthStats.trend.a11y', {
    metric: t(`insights.healthStats.metric.${metric}`),
    from: formatShort(window.from),
    to: formatShort(window.to),
    count: points.length,
    last: last ? formatMetric(metric, last.rolling) : '',
  });

  return (
    <View style={styles.wrap}>
      <View accessible accessibilityRole="image" accessibilityLabel={label} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))} style={styles.plot}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            <Line x1={AXIS} x2={width} y1={y(hi)} y2={y(hi)} stroke={colors.border} strokeWidth={1} />
            <Line x1={AXIS} x2={width} y1={y(lo)} y2={y(lo)} stroke={colors.border} strokeWidth={1} />
            {goal !== undefined ? <Line x1={AXIS} x2={width} y1={y(goal)} y2={y(goal)} stroke={colors.textMuted} strokeWidth={1} strokeDasharray="4 4" /> : null}
            <Path d={dots} stroke={colors.accent} strokeWidth={dot} strokeLinecap="round" opacity={0.45} />
            <Path d={line} stroke={colors.text} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          </Svg>
        ) : null}
        <AppText variant="caption" muted style={[styles.tick, { top: y(hi) - 8 }]} numberOfLines={1}>
          {formatMetric(metric, hi)}
        </AppText>
        {goal !== undefined ? (
          <AppText variant="caption" muted style={[styles.tick, { top: y(goal) - 8 }]} numberOfLines={1}>
            {formatMetric(metric, goal)}
          </AppText>
        ) : null}
        <AppText variant="caption" muted style={[styles.tick, { top: y(lo) - 8 }]} numberOfLines={1}>
          {formatMetric(metric, lo)}
        </AppText>
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
          <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
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
        {goal !== undefined ? (
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: colors.textMuted }]} />
            <AppText variant="caption" muted>
              {t('insights.healthStats.trend.goal')}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  plot: { height: HEIGHT },
  tick: { position: 'absolute', left: 0, width: AXIS - 4 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLine: { width: 14, height: 2, borderRadius: 1 },
});
