import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import type { MoodLevel } from '@/db/schema';
import { activityLabel, levelMood, type Catalog } from '@/lib/catalog/catalog';
import { formatWeekdayLong, type DateString } from '@/lib/dates';
import { formatDurationShort, formatSteps } from '@/lib/health/format';
import { upper } from '@/lib/i18n/language';
import { formatPercent } from '@/lib/insights/format';
import type { GoodTomorrow, TomorrowReason } from '@/lib/outlook/tomorrow';
import { formatScaleValue } from '@/lib/scales/format';
import { spacing, useTheme } from '@/lib/theme';

/** Only a hit rate above this is worded "wahrscheinlich"; below it the card says "better than usual". */
const LIKELY_FROM = 0.5;

/**
 * "Morgen könnte ein guter Tag werden": only ever this good news. On the morning after, before the
 * day's entry, the same hint again as "Gute Aussichten für heute", worded from today looking back. With a backtest behind it the card
 * names how often it came true after days that reached the same step; without, it says that this
 * is still open.
 * There is no card for a day that looks worse.
 */
export function GoodTomorrowCard({ hint, catalog, morning = false }: { hint: GoodTomorrow; catalog: Catalog; morning?: boolean }) {
  const { mood: moodColors } = useTheme();
  const { t } = useTranslation();
  // The morning texts look back from the day the hint is about; the rest is shared.
  const key = (name: string) => (morning ? `outlook.tomorrow.morning.${name}` : `outlook.tomorrow.${name}`);
  const level = Math.min(5, Math.max(1, hint.level)) as MoodLevel;
  const mood = levelMood(catalog, level);
  const reason = (value: TomorrowReason, date: DateString) => {
    switch (value.kind) {
      case 'mood':
        return t(key('reasonMood'));
      case 'sleep':
        return t('outlook.tomorrow.reasonSleep', { value: formatDurationShort(value.minutes) });
      case 'steps':
        return t(key('reasonSteps'), { value: formatSteps(value.steps) });
      case 'activity':
        return activityLabel(catalog, value.activityId);
      case 'scale': {
        const scale = catalog.scaleById.get(value.scaleId);
        // A rating averaged over two entries is 3.5, not a whole step.
        return scale ? `${scale.name} ${scale.kind === 'rating' && Number.isInteger(value.value) ? value.value : formatScaleValue(scale, value.value)}` : '';
      }
      case 'weekday':
        return t(key('reasonWeekday'), { weekday: formatWeekdayLong(date) });
    }
  };
  const reasons = hint.reasons.map((value) => reason(value, hint.date)).filter(Boolean);
  const proof = hint.proof;
  // Without a backtest behind it only the top step may say that today is among the best days.
  const body = !proof
    ? t(key(hint.tier === 'top' ? 'bodyOpen' : 'bodyAbove'), { mood: mood.label })
    : t(key(proof.hitRate > LIKELY_FROM ? 'bodyLikely' : 'bodyBetter'), {
        mood: mood.label,
        hit: formatPercent(proof.hitRate),
        usual: formatPercent(proof.usual),
        count: proof.cases,
      });
  return (
    <Card>
      <AppText variant="caption" muted>
        {upper(t('settings.outlook'))}
      </AppText>
      <View style={styles.row}>
        <MaterialCommunityIcons name={mood.icon} size={28} color={moodColors[level].strong} />
        <AppText variant="headline" style={styles.flex}>
          {t(key('title'))}
        </AppText>
      </View>
      <AppText>{body}</AppText>
      {reasons.length ? <AppText muted>{t('outlook.tomorrow.reasons', { names: reasons.join(', ') })}</AppText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
