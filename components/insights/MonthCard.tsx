import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { formatMonthLong, formatMonthShort } from '@/lib/dates';
import { formatDecimal, type MonthMean } from '@/lib/insights';
import { roundLevel } from '@/lib/mood/dayMood';
import { moodColors, useTheme } from '@/lib/theme';

import { InsightCard } from './InsightCard';

interface Props {
  months: MonthMean[];
}

const PLOT_HEIGHT = 140;
const X_LABELS_HEIGHT = 22;
const MIN_LABEL_SPACING = 40;
const Y_AXIS_WIDTH = 32;
/** Plot + x labels + headroom; the wrapper clips anything the library adds beyond that (as in Zyklus). */
const FRAME_HEIGHT = PLOT_HEIGHT + X_LABELS_HEIGHT + 24;

/** Mean per month as bars on the 1 to 5 scale, each in the colour of its rounded mean. */
export function MonthCard({ months }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const plotWidth = Math.max(0, width - Y_AXIS_WIDTH - 12);
  const step = Math.max(12, Math.floor((plotWidth - 20) / Math.max(1, months.length)));
  // Only every n-th label, so neighbouring month names never overlap.
  const labelEvery = Math.max(1, Math.ceil(MIN_LABEL_SPACING / step));
  const data = months.map((month, i) => ({
    value: month.mean,
    label: i % labelEvery === 0 ? formatMonthShort(month.month) : '',
    frontColor: moodColors[roundLevel(month.mean)].strong,
  }));
  const spoken = months.map((month) => `${formatMonthLong(month.month)} ${formatDecimal(month.mean)}`).join(', ');

  return (
    <InsightCard title={t('insights.months.title')} empty={months.length === 0 ? t('insights.months.empty') : null}>
      <View
        onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${t('insights.months.title')}: ${spoken}`}
        style={[styles.plot, { height: FRAME_HEIGHT }]}
      >
        {width > 0 ? (
          <BarChart
            data={data}
            width={plotWidth}
            height={PLOT_HEIGHT}
            barWidth={Math.min(28, Math.max(6, step - 6))}
            spacing={Math.max(4, step - Math.min(28, Math.max(6, step - 6)))}
            initialSpacing={8}
            barBorderTopLeftRadius={4}
            barBorderTopRightRadius={4}
            // The library subtracts yAxisOffset from every value; maxValue is relative to it.
            yAxisOffset={1}
            maxValue={4}
            noOfSections={4}
            yAxisLabelWidth={Y_AXIS_WIDTH}
            yAxisColor="transparent"
            xAxisColor={colors.border}
            rulesColor={colors.border}
            rulesType="solid"
            yAxisTextStyle={{ color: colors.textMuted, fontSize: 12 }}
            xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 11, width: MIN_LABEL_SPACING, textAlign: 'center' }}
            xAxisLabelsHeight={X_LABELS_HEIGHT}
            disableScroll
          />
        ) : null}
      </View>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  plot: { overflow: 'hidden' },
});
