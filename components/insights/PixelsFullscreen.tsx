import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Rect, Text as SvgText, TSpan } from 'react-native-svg';

import { Button, Chip } from '@/components/ui';
import { LogoShapes } from '@/components/ui/Logo';
import { LOGO_CENTER, LOGO_COLORS } from '@/components/ui/logoPaths';
import { MOOD_LEVELS, type MoodLevel } from '@/db/schema';
import { formatMonthShort, type DateString } from '@/lib/dates';
import { saveBase64ToPickedDirectory, shareBase64, ShareUnavailableError } from '@/lib/export/files';
import type { PixelMonth } from '@/lib/insights';
import { useCloseOnLock } from '@/lib/lock/useCloseOnLock';
import { TOUCH_TARGET, spacing, useTheme } from '@/lib/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  year: number;
  years: number[];
  onYear: (year: number) => void;
  months: PixelMonth[];
  today: DateString;
  title: string;
  moodLabel: (level: MoodLevel) => string;
  /** Screen reader text for the whole year, the same as on the card. */
  summary: string;
  onOpen: (date: DateString) => void;
}

// The picture in its own units; on screen and in the PNG it is scaled as a whole.
const PAD = 20;
const TITLE = 44;
const HEAD = 18;
const DAY_LABEL = 22;
const CELL = 22;
const GAP = 3;
const LEGEND_GAP = 16;
const LEGEND_ROW = 20;
const LEGEND_ROWS = Math.ceil(MOOD_LEVELS.length / 2);
/** The line with logo and app name below the legend, so a shared picture says where it comes from. */
const FOOTER = 24;
const FOOTER_LOGO = 14;
const GRID_X = PAD + DAY_LABEL;
const GRID_Y = PAD + TITLE + HEAD;
const WIDTH = GRID_X + 12 * CELL + PAD;
const FOOTER_Y = GRID_Y + 31 * CELL + LEGEND_GAP + LEGEND_ROWS * LEGEND_ROW + FOOTER - FOOTER_LOGO;
const HEIGHT = FOOTER_Y + FOOTER_LOGO + PAD;
/** The PNG is this many times the picture's own units: about 1300 by 3400 pixels. */
const EXPORT_SCALE = 4;

/**
 * The year in pixels on its own: months as columns and days as rows, which fills a phone held
 * upright far better than the card's twelve rows. Title, year and legend are part of the picture,
 * so the saved PNG explains itself; a line with logo and app name at the bottom says where a shared
 * picture comes from. Tapping a cell still opens that day.
 */
export function PixelsFullscreen({ visible, onClose, year, years, onYear, months, today, title, moodLabel, summary, onOpen }: Props) {
  const { t } = useTranslation();
  const { colors, mood: moodColors } = useTheme();
  const insets = useSafeAreaInsets();
  const svg = useRef<Svg>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  useCloseOnLock(onClose);

  const scale = area.width > 0 ? Math.min(area.width / WIDTH, area.height / HEIGHT) : 0;
  const levels = [...MOOD_LEVELS].reverse();

  const open = (x: number, y: number) => {
    const col = Math.floor((x / scale - GRID_X) / CELL);
    const row = Math.floor((y / scale - GRID_Y) / CELL);
    const month = months[col];
    if (!month || row < 0 || row >= month.levels.length) return;
    const date = `${month.month.slice(0, 8)}${String(row + 1).padStart(2, '0')}` as DateString;
    if (date > today) return;
    onClose();
    onOpen(date);
  };

  /** Renders the picture as a PNG and hands it to `deliver`: saving it in a folder or sharing it. */
  const render = useCallback(
    async (deliver: (name: string, base64: string) => Promise<void>) => {
      const current = svg.current;
      if (!current || busy) return;
      setBusy(true);
      try {
        const base64 = await new Promise<string>((resolve) =>
          current.toDataURL(resolve, { width: WIDTH * EXPORT_SCALE, height: HEIGHT * EXPORT_SCALE }),
        );
        await deliver(`daylight-pixels-${year}.png`, base64);
      } catch (error) {
        Alert.alert(
          t('common.error'),
          error instanceof ShareUnavailableError ? t('common.shareUnavailable') : error instanceof Error ? error.message.slice(0, 300) : String(error),
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, t, year],
  );

  const save = () =>
    render(async (name, base64) => {
      if (await saveBase64ToPickedDirectory(name, 'image/png', base64)) Alert.alert(t('settings.saved'));
    });
  const share = () => render((name, base64) => shareBase64(name, 'image/png', base64));

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.header}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.years} style={styles.flex}>
            {years.length > 1
              ? years.map((y) => <Chip key={y} label={String(y)} selected={y === year} onPress={() => onYear(y)} />)
              : null}
          </ScrollView>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={8}
            style={({ pressed }) => [styles.close, { backgroundColor: colors.surface, opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.area} onLayout={(e) => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
          {scale > 0 ? (
            <Pressable
              onPress={(e) => open(e.nativeEvent.locationX, e.nativeEvent.locationY)}
              accessibilityRole="image"
              accessibilityLabel={`${year}. ${summary}`}
              accessibilityHint={t('insights.pixels.a11yHint')}
            >
              <Svg ref={svg} width={WIDTH * scale} height={HEIGHT * scale} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
                <Rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={colors.surface} />
                <SvgText x={PAD} y={PAD + 22} fontSize={18} fontWeight="bold" fill={colors.text}>
                  {title}
                </SvgText>
                <SvgText x={WIDTH - PAD} y={PAD + 22} fontSize={18} fontWeight="bold" fill={colors.accent} textAnchor="end">
                  {String(year)}
                </SvgText>
                {months.map((month, col) => (
                  <SvgText key={month.month} x={GRID_X + col * CELL + (CELL - GAP) / 2} y={GRID_Y - 6} fontSize={8} fill={colors.textMuted} textAnchor="middle">
                    {formatMonthShort(month.month)}
                  </SvgText>
                ))}
                {Array.from({ length: 31 }, (_, row) => (
                  <SvgText key={row} x={GRID_X - 5} y={GRID_Y + row * CELL + CELL / 2 + 1} fontSize={8} fill={colors.textMuted} textAnchor="end">
                    {String(row + 1)}
                  </SvgText>
                ))}
                {months.flatMap((month, col) =>
                  month.levels.map((level, row) => {
                    const date = `${month.month.slice(0, 8)}${String(row + 1).padStart(2, '0')}`;
                    return (
                      <Rect
                        key={date}
                        x={GRID_X + col * CELL}
                        y={GRID_Y + row * CELL}
                        width={CELL - GAP}
                        height={CELL - GAP}
                        rx={4}
                        fill={level ? moodColors[level].strong : colors.surfaceMuted}
                        opacity={date > today ? 0.4 : 1}
                      />
                    );
                  }),
                )}
                {levels.map((level, i) => (
                  <G key={level} x={GRID_X + (i % 2) * ((12 * CELL) / 2)} y={GRID_Y + 31 * CELL + LEGEND_GAP + Math.floor(i / 2) * LEGEND_ROW}>
                    <Rect x={0} y={0} width={11} height={11} rx={2} fill={moodColors[level].strong} />
                    <SvgText x={17} y={9.5} fontSize={11} fill={colors.textMuted}>
                      {moodLabel(level)}
                    </SvgText>
                  </G>
                ))}
                <G transform={`translate(${GRID_X} ${FOOTER_Y}) scale(${FOOTER_LOGO / 72}) translate(${36 - LOGO_CENTER} ${36 - LOGO_CENTER})`}>
                  <Circle cx={LOGO_CENTER} cy={LOGO_CENTER} r={36} fill={LOGO_COLORS.background} />
                  <LogoShapes mark={LOGO_COLORS.mark} sun={LOGO_COLORS.sun} />
                </G>
                <SvgText x={GRID_X + FOOTER_LOGO + 6} y={FOOTER_Y + FOOTER_LOGO / 2 + 4} fontSize={11} fill={colors.textMuted}>
                  <TSpan fontWeight="bold" fill={colors.text}>
                    Daylight
                  </TSpan>
                  {` · ${t('insights.pixels.footer')}`}
                </SvgText>
              </Svg>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button label={t('insights.pixels.save')} variant="secondary" onPress={save} disabled={busy || scale === 0} style={styles.flex} />
          <Button label={t('insights.pixels.share')} onPress={share} disabled={busy || scale === 0} style={styles.flex} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.md },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  years: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  close: { width: TOUCH_TARGET, height: TOUCH_TARGET, borderRadius: TOUCH_TARGET / 2, alignItems: 'center', justifyContent: 'center' },
  area: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
