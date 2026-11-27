import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, PressableScale } from '@/components/ui';
import type { DateString } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { upper } from '@/lib/i18n/language';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';
import { roomInYear } from '@/lib/turning/rules';
import { useTurningPointOn, useTurningPoints } from '@/lib/turning/useTurningPoints';

import { DAWN } from './dawn';

/**
 * Under the entries of a day: the turning point set on it, which opens the comparison, or a quiet
 * way to set one. Nothing once the year holds all it may. `extra` is a further quiet row (on "Heute":
 * "Selbstversuch starten"), set in the same muted card under "Wendepunkt setzen", or in a muted card
 * of its own when there is no such row.
 */
export function TurningDayCard({ date, extra }: { date: DateString; extra?: ReactNode }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const point = useTurningPointOn(date);
  const all = useTurningPoints();

  const extraCard = extra ? <Card tone="muted">{extra}</Card> : null;

  if (point) {
    return (
      <>
        <PressableScale
          pressedScale={0.98}
          onPress={() => {
            haptics.tap();
            router.push({ pathname: '/turning/[id]', params: { id: String(point.id) } });
          }}
          accessibilityRole="button"
          accessibilityLabel={t('turning.cardA11y', { title: point.title })}
          style={[styles.marked, { backgroundColor: DAWN.skyMid }]}
        >
          <View style={styles.sun}>
            <MaterialCommunityIcons name="flag-variant" size={20} color={DAWN.sky} />
          </View>
          <View style={styles.text}>
            <AppText variant="caption" color={DAWN.sun} style={styles.eyebrow}>
              {upper(t('turning.eyebrow'))}
            </AppText>
            <AppText variant="headline" color={DAWN.text}>
              {point.title}
            </AppText>
            <AppText variant="caption" color={DAWN.textSoft}>
              {t('turning.compare')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={DAWN.textSoft} />
        </PressableScale>
        {extraCard}
      </>
    );
  }

  if (
    roomInYear(
      all.map((p) => p.date),
      date,
    ) === 0
  )
    return extraCard;
  return (
    <Card tone="muted">
      <PressableScale
        pressedScale={0.98}
        onPress={() => {
          haptics.tap();
          router.push({ pathname: '/turning/new', params: { date } });
        }}
        accessibilityRole="button"
        style={styles.row}
      >
        <MaterialCommunityIcons name="flag-variant-outline" size={20} color={colors.accent} />
        <View style={styles.text}>
          <AppText variant="label">{t('turning.mark')}</AppText>
          <AppText variant="caption" muted>
            {t('turning.markHint')}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </PressableScale>
      {extra}
    </Card>
  );
}

const styles = StyleSheet.create({
  marked: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, overflow: 'hidden' },
  sun: { width: 40, height: 40, borderRadius: 20, backgroundColor: DAWN.sun, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  eyebrow: { letterSpacing: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET },
});
