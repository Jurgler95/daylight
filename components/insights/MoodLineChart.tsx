import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { MOOD_LEVELS, type MoodLevel } from '@/db/schema';
import { daysBetween, formatShort, formatWeekdayShort, type DateString } from '@/lib/dates';
import { formatDecimal, ROLLING_DAYS, windowLength, type DayWindow, type MoodPoint } from '@/lib/insights';
import type { IconName } from '@/lib/icons';
import { roundLevel } from '@/lib/mood/dayMood';
import { spacing, useTheme } from '@/lib/theme';

import { ChartFullscreen } from './chart/ChartFullscreen';
import { ChartTooltip } from './chart/ChartTooltip';
import { DateAxis } from './chart/DateAxis';
import { ExpandButton } from './chart/ExpandButton';
import { nearestIndex, useInspector } from './chart/useInspector';

interface Props {
  points: MoodPoint[];
  window: DayWindow;
  mean: number | null;
  iconFor: (level: MoodLevel) => IconName;
  /** Turning points inside the window, drawn as dashed lines with a flag on top. */
  marks?: readonly DateString[];
  /** Headline of the large view; "Verlauf" when left out. */
  title?: string;
}

const HEIGHT = 150;
const AXIS = 26;
const PAD = 8;

/** The mood trend with its button to open it large and sideways. */
export function MoodLineChart(props: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <MoodLinePlot {...props} onExpand={() => setOpen(true)} />
      <ChartFullscreen visible={open} onClose={() => setOpen(false)} title={props.title ?? t('insights.trend.title')}>
        {(height) => <MoodLinePlot {...props} height={height} ticks={5} />}
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
 * Day means as dots in their mood colour, the 7-day mean as a line. Drawn with plain SVG: a year
 * has 365 dots, which as one path per level stays cheap where a chart library would draw a
 * component per point. The line breaks where a gap is longer than its own week. Tapping or
 * dragging across it shows the day under the finger with its mood and 7-day mean.
 */
function MoodLinePlot({ points, window, mean, iconFor, marks = [], height = HEIGHT, ticks = 2, onExpand }: PlotProps) {
  const { t } = useTranslation();
  const { colors, mood: moodColors } = useTheme();
  const [width, setWidth] = useState(0);
  const plotWidth = Math.max(0, width - AXIS - PAD * 2);
  const plotHeight = height - PAD * 2;
  const span = Math.max(1, windowLength(window) - 1);
  const x = useCallback((date: DateString) => AXIS + PAD + (daysBetween(window.from, date) / span) * plotWidth, [window.from, span, plotWidth]);
  const y = (value: number) => PAD + ((5 - value) / 4) * plotHeight;
  const dot = span > 120 ? 4 : span > 40 ? 6 : 8;

  const xs = useMemo(() => points.map((point) => x(point.date)), [points, x]);
  const pick = useCallback((touchX: number) => (touchX < AXIS ? null : nearestIndex(xs, touchX)), [xs]);
  const { selected, responder } = useInspector(pick);
  const picked = selected === null ? undefined : points[selected];

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
  // Without a mean (turning points, experiments) the label leaves that part out rather than saying "Schnitt ,".
  const label = t(mean === null ? 'insights.trend.a11yNoMean' : 'insights.trend.a11y', {
    from: formatShort(window.from),
    to: formatShort(window.to),
    count: points.length,
    mean: mean === null ? '' : formatDecimal(mean),
    last: last ? formatDecimal(last.rolling) : '',
  });
  const pickedLevel = picked ? roundLevel(picked.mean) : null;

  return (
    <View style={styles.wrap}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
        style={{ height }}
        {...responder}
      >
        {width > 0 ? (
          <Svg width={width} height={height} pointerEvents="none">
            {MOOD_LEVELS.map((level) => (
              <Line key={level} x1={AXIS} x2={width} y1={y(level)} y2={y(level)} stroke={colors.border} strokeWidth={1} />
            ))}
            {[...dots.entries()].map(([level, d]) => (
              <Path key={level} d={d} stroke={moodColors[level].strong} strokeWidth={dot} strokeLinecap="round" opacity={picked ? 0.3 : 0.55} />
            ))}
            {shownMarks.map((date) => (
              <Line key={date} x1={x(date)} x2={x(date)} y1={PAD + 6} y2={height - PAD} stroke={colors.accent} strokeWidth={1.5} strokeDasharray="4 3" />
            ))}
            <Path d={line} stroke={colors.text} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {picked && pickedLevel !== null ? (
              <>
                <Line x1={x(picked.date)} x2={x(picked.date)} y1={PAD} y2={height - PAD} stroke={colors.textMuted} strokeWidth={1} />
                <Circle cx={x(picked.date)} cy={y(picked.rolling)} r={4} fill={colors.surface} stroke={colors.text} strokeWidth={2} />
                <Circle cx={x(picked.date)} cy={y(picked.mean)} r={6} fill={moodColors[pickedLevel].strong} stroke={colors.surface} strokeWidth={2} />
              </>
            ) : null}
          </Svg>
        ) : null}
        {width > 0
          ? shownMarks.map((date) => (
              <View key={date} pointerEvents="none" style={[styles.flag, { left: x(date) - 7 }]}>
                <MaterialCommunityIcons name="flag-variant" size={14} color={colors.accent} />
              </View>
            ))
          : null}
        {MOOD_LEVELS.map((level) => (
          <View key={level} pointerEvents="none" style={[styles.icon, { top: y(level) - 9 }]}>
            <MaterialCommunityIcons name={iconFor(level)} size={18} color={moodColors[level].strong} />
          </View>
        ))}
        {picked && pickedLevel !== null ? (
          <ChartTooltip x={x(picked.date)} width={width}>
            <AppText variant="caption" muted>
              {`${formatWeekdayShort(picked.date)}, ${formatShort(picked.date)}`}
            </AppText>
            <View style={styles.tipRow}>
              <MaterialCommunityIcons name={iconFor(pickedLevel)} size={16} color={moodColors[pickedLevel].strong} />
              <AppText variant="label">{formatDecimal(picked.mean)}</AppText>
              <AppText variant="caption" muted>
                {`${t('insights.trend.week')} ${formatDecimal(picked.rolling)}`}
              </AppText>
            </View>
          </ChartTooltip>
        ) : null}
      </View>
      <DateAxis window={window} inset={AXIS} ticks={ticks} />
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
        {onExpand ? <ExpandButton onPress={onExpand} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  icon: { position: 'absolute', left: 0 },
  flag: { position: 'absolute', top: -6 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLine: { width: 14, height: 2, borderRadius: 1 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
