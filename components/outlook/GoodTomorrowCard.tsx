import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import type { MoodLevel } from '@/db/schema';
import { activityLabel, levelMood, type Catalog } from '@/lib/catalog/catalog';
import { formatWeekdayLong, type DateString } from '@/lib/dates';
import { formatDurationShort, formatSteps } from '@/lib/health/format';
import { formatPercent } from '@/lib/insights/format';
import type { GoodTomorrow, TomorrowReason } from '@/lib/outlook/tomorrow';
import { formatScaleValue } from '@/lib/scales/format';
import { moodColors, spacing } from '@/lib/theme';

/** Only a hit rate above this is worded "wahrscheinlich"; below it the card says "better than usual". */
const LIKELY_FROM = 0.5;

/**
 * "Morgen könnte ein guter Tag werden": only ever this good news. With a backtest behind it the card
 * names how often it came true after days that reached the same step; without, it says that this
 * is still open.
 * There is no card for a day that looks worse.
 */
export function GoodTomorrowCard({ hint, catalog }: { hint: GoodTomorrow; catalog: Catalog }) {
  const { t } = useTranslation();
  const level = Math.min(5, Math.max(1, hint.level)) as MoodLevel;
  const mood = levelMood(catalog, level);
  const reason = (value: TomorrowReason, date: DateString) => {
    switch (value.kind) {
      case 'mood':
        return t('outlook.tomorrow.reasonMood');
      case 'sleep':
        return t('outlook.tomorrow.reasonSleep', { value: formatDurationShort(value.minutes) });
      case 'steps':
        return t('outlook.tomorrow.reasonSteps', { value: formatSteps(value.steps) });
      case 'activity':
        return activityLabel(catalog, value.activityId);
      case 'scale': {
        const scale = catalog.scaleById.get(value.scaleId);
        // A rating averaged over two entries is 3.5, not a whole step.
        return scale ? `${scale.name} ${scale.kind === 'rating' && Number.isInteger(value.value) ? value.value : formatScaleValue(scale, value.value)}` : '';
      }
      case 'weekday':
        return t('outlook.tomorrow.reasonWeekday', { weekday: formatWeekdayLong(date) });
    }
  };
  const reasons = hint.reasons.map((value) => reason(value, hint.date)).filter(Boolean);
  const proof = hint.proof;
  // Without a backtest behind it only the top step may say that today is among the best days.
  const body = !proof
    ? t(hint.tier === 'top' ? 'outlook.tomorrow.bodyOpen' : 'outlook.tomorrow.bodyAbove', { mood: mood.label })
    : t(proof.hitRate > LIKELY_FROM ? 'outlook.tomorrow.bodyLikely' : 'outlook.tomorrow.bodyBetter', {
        mood: mood.label,
        hit: formatPercent(proof.hitRate),
        usual: formatPercent(proof.usual),
        count: proof.cases,
      });
  return (
    <Card>
      <AppText variant="caption" muted>
        {t('settings.outlook').toUpperCase()}
      </AppText>
      <View style={styles.row}>
        <MaterialCommunityIcons name={mood.icon} size={28} color={moodColors[level].strong} />
        <AppText variant="headline" style={styles.flex}>
          {t('outlook.tomorrow.title')}
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
