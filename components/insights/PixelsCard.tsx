import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { AppText, Chip } from '@/components/ui';
import { MOOD_LEVELS, type MoodLevel } from '@/db/schema';
import { formatMonthLong, formatMonthNarrow, type DateString } from '@/lib/dates';
import { yearPixels, type InsightDay } from '@/lib/insights';
import { moodColors, spacing, useTheme } from '@/lib/theme';

import { InsightCard } from './InsightCard';

interface Props {
  days: InsightDay[];
  years: number[];
  today: DateString;
  moodLabel: (level: MoodLevel) => string;
  onOpen: (date: DateString) => void;
}

const LABEL = 16;
const GAP = 2;

/**
 * A year as twelve rows of day cells in the mood colour, empty where nothing was logged. The
 * range switch does not apply: a year is the point of the card, other years sit behind chips.
 * Tapping a cell opens that day on "Heute".
 */
export function PixelsCard({ days, years, today, moodLabel, onOpen }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [picked, setPicked] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const year = picked !== null && years.includes(picked) ? picked : (years[0] ?? Number(today.slice(0, 4)));
  const months = useMemo(() => yearPixels(days, year), [days, year]);
  const cell = Math.max(4, Math.floor((width - LABEL) / 31));

  const summary = months
    .map((month) => {
      const counts = [...MOOD_LEVELS].reverse().flatMap((level) => {
        const n = month.levels.filter((l) => l === level).length;
        return n ? [`${t('insights.days', { count: n })} ${moodLabel(level)}`] : [];
      });
      return counts.length
        ? t('insights.pixels.a11yMonth', { month: formatMonthLong(month.month), summary: counts.join(', ') })
        : t('insights.pixels.a11yEmpty', { month: formatMonthLong(month.month) });
    })
    .join('. ');

  const open = (x: number, y: number) => {
    const row = Math.floor(y / cell);
    const col = Math.floor((x - LABEL) / cell);
    const month = months[row];
    if (!month || col < 0 || col >= month.levels.length) return;
    const date = `${month.month.slice(0, 8)}${String(col + 1).padStart(2, '0')}` as DateString;
    if (date <= today) onOpen(date);
  };

  return (
    <InsightCard
      title={t('insights.pixels.title')}
      controls={
        years.length > 1 ? (
          <View style={styles.years} accessibilityRole="radiogroup" accessibilityLabel={t('insights.pixels.year')}>
            {years.map((y) => (
              <Chip key={y} label={String(y)} selected={y === year} onPress={() => setPicked(y)} />
            ))}
          </View>
        ) : null
      }
    >
      <Pressable
        onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
        onPress={(e) => open(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        accessibilityRole="image"
        accessibilityLabel={`${year}. ${summary}`}
        accessibilityHint={t('insights.pixels.a11yHint')}
        style={{ height: width > 0 ? cell * 12 : 0 }}
      >
        {width > 0 ? (
          <Svg width={width} height={cell * 12}>
            {months.map((month, row) => (
              <SvgText key={month.month} x={0} y={row * cell + cell - 1} fontSize={Math.min(11, cell)} fill={colors.textMuted}>
                {formatMonthNarrow(month.month)}
              </SvgText>
            ))}
            {months.flatMap((month, row) =>
              month.levels.map((level, col) => {
                const date = `${month.month.slice(0, 8)}${String(col + 1).padStart(2, '0')}`;
                return (
                  <Rect
                    key={date}
                    x={LABEL + col * cell}
                    y={row * cell}
                    width={cell - GAP}
                    height={cell - GAP}
                    rx={Math.min(3, cell / 4)}
                    fill={level ? moodColors[level].strong : colors.surfaceMuted}
                    opacity={date > today ? 0.4 : 1}
                  />
                );
              }),
            )}
          </Svg>
        ) : null}
      </Pressable>
      <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {[...MOOD_LEVELS].reverse().map((level) => (
          <View key={level} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: moodColors[level].strong }]} />
            <AppText variant="caption" muted>
              {moodLabel(level)}
            </AppText>
          </View>
        ))}
      </View>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  years: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 10, height: 10, borderRadius: 2 },
});
