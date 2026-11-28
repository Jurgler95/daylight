import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { daysBetween, formatShort, formatWeekdayShort, type DateString } from '@/lib/dates';
import { ROLLING_DAYS, windowLength, type DayWindow, type HealthPoint } from '@/lib/insights';
import { spacing, useTheme } from '@/lib/theme';

import { ChartFullscreen } from './chart/ChartFullscreen';
import { ChartTooltip } from './chart/ChartTooltip';
import { DateAxis } from './chart/DateAxis';
import { ExpandButton } from './chart/ExpandButton';
import { nearestIndex, useInspector } from './chart/useInspector';

interface Props {
  points: HealthPoint[];
  window: DayWindow;
  /** Bottom and top of the plot. */
  lo: number;
  hi: number;
  format: (value: number) => string;
  accessibilityLabel: string;
  /** Drawn as a dashed line, e.g. 7 h of sleep. */
  goal?: number;
  /** Headline of the large view. */
  title?: string;
}

const HEIGHT = 140;
const AXIS = 52;
const PAD = 8;

/** A value trend with its button to open it large and sideways. */
export function ValueLineChart(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ValueLinePlot {...props} onExpand={() => setOpen(true)} />
      <ChartFullscreen visible={open} onClose={() => setOpen(false)} title={props.title}>
        {(height) => <ValueLinePlot {...props} height={height} ticks={5} />}
      </ChartFullscreen>
    </>
  );
}

interface PlotProps extends Props {
  height?: number;
  ticks?: number;
  onExpand?: () => void;
}

/**
 * Day values as dots, the 7-day mean as a line, like the mood trend. For health values and scales
 * alike. Tapping or dragging across it shows the day under the finger with its value and 7-day mean.
 */
function ValueLinePlot({ points, window, lo, hi, format, accessibilityLabel, goal, height = HEIGHT, ticks = 2, onExpand }: PlotProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const plotWidth = Math.max(0, width - AXIS - PAD * 2);
  const plotHeight = height - PAD * 2;
  const span = Math.max(1, windowLength(window) - 1);
  const x = useCallback((date: DateString) => AXIS + PAD + (daysBetween(window.from, date) / span) * plotWidth, [window.from, span, plotWidth]);
  const y = (value: number) => PAD + ((hi - value) / (hi - lo)) * plotHeight;
  const dot = span > 120 ? 4 : span > 40 ? 6 : 8;

  const xs = useMemo(() => points.map((point) => x(point.date)), [points, x]);
  const pick = useCallback((touchX: number) => (touchX < AXIS ? null : nearestIndex(xs, touchX)), [xs]);
  const { selected, responder } = useInspector(pick);
  const picked = selected === null ? undefined : points[selected];

  let dots = '';
  let line = '';
  points.forEach((point, i) => {
    dots += `M${x(point.date).toFixed(1)} ${y(point.value).toFixed(1)}h0.01`;
    const previous = points[i - 1];
    const jump = !previous || daysBetween(previous.date, point.date) > ROLLING_DAYS;
    line += `${jump ? 'M' : 'L'}${x(point.date).toFixed(1)} ${y(point.rolling).toFixed(1)}`;
  });

  return (
    <View style={styles.wrap}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
        style={{ height }}
        {...responder}
      >
        {width > 0 ? (
          <Svg width={width} height={height} pointerEvents="none">
            <Line x1={AXIS} x2={width} y1={y(hi)} y2={y(hi)} stroke={colors.border} strokeWidth={1} />
            <Line x1={AXIS} x2={width} y1={y(lo)} y2={y(lo)} stroke={colors.border} strokeWidth={1} />
            {goal !== undefined ? <Line x1={AXIS} x2={width} y1={y(goal)} y2={y(goal)} stroke={colors.textMuted} strokeWidth={1} strokeDasharray="4 4" /> : null}
            <Path d={dots} stroke={colors.accent} strokeWidth={dot} strokeLinecap="round" opacity={picked ? 0.25 : 0.45} />
            <Path d={line} stroke={colors.text} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {picked ? (
              <>
                <Line x1={x(picked.date)} x2={x(picked.date)} y1={PAD} y2={height - PAD} stroke={colors.textMuted} strokeWidth={1} />
                <Circle cx={x(picked.date)} cy={y(picked.rolling)} r={4} fill={colors.surface} stroke={colors.text} strokeWidth={2} />
                <Circle cx={x(picked.date)} cy={y(picked.value)} r={6} fill={colors.accent} stroke={colors.surface} strokeWidth={2} />
              </>
            ) : null}
          </Svg>
        ) : null}
        <AppText variant="caption" muted pointerEvents="none" style={[styles.tick, { top: y(hi) - 8 }]} numberOfLines={1}>
          {format(hi)}
        </AppText>
        {goal !== undefined ? (
          <AppText variant="caption" muted pointerEvents="none" style={[styles.tick, { top: y(goal) - 8 }]} numberOfLines={1}>
            {format(goal)}
          </AppText>
        ) : null}
        <AppText variant="caption" muted pointerEvents="none" style={[styles.tick, { top: y(lo) - 8 }]} numberOfLines={1}>
          {format(lo)}
        </AppText>
        {picked ? (
          <ChartTooltip x={x(picked.date)} width={width}>
            <AppText variant="caption" muted>
              {`${formatWeekdayShort(picked.date)}, ${formatShort(picked.date)}`}
            </AppText>
            <View style={styles.tipRow}>
              <AppText variant="label">{format(picked.value)}</AppText>
              <AppText variant="caption" muted>
                {`${t('insights.trend.week')} ${format(picked.rolling)}`}
              </AppText>
            </View>
          </ChartTooltip>
        ) : null}
      </View>
      <DateAxis window={window} inset={AXIS} ticks={ticks} />
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
        {onExpand ? <ExpandButton onPress={onExpand} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  tick: { position: 'absolute', left: 0, width: AXIS - 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLine: { width: 14, height: 2, borderRadius: 1 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
