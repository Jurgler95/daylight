import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { InsightLine } from '@/components/insights/ActivityLine';
import { InsightCard } from '@/components/insights/InsightCard';
import { AppText } from '@/components/ui';
import type { InsightRange, ScaleFacts, ScaleInsight } from '@/lib/insights';
import type { IconName } from '@/lib/icons';
import { formatScaleDifference, formatScaleValue } from '@/lib/scales/format';

const KIND_ICONS: Record<ScaleFacts['kind'], IconName> = { rating: 'tune-vertical', duration: 'timer-outline', number: 'numeric' };

export function scaleIcon(scale: Pick<ScaleFacts, 'kind'>): IconName {
  return KIND_ICONS[scale.kind];
}

/**
 * Every scale with a value in the range, one row each like the activities in "Gruppenblick": mean,
 * days and the change against the range before. A tap opens the scale's own page.
 */
export function ScaleListCard({ insights, range }: { insights: readonly ScaleInsight[]; range: InsightRange }) {
  const { t } = useTranslation();
  return (
    <InsightCard title={t('insights.scales.list.title')} empty={insights.length === 0 ? t('insights.scales.emptyRange') : null}>
      {insights.map(({ scale, summary }) => {
        const mean = formatScaleValue(scale, summary.mean);
        const change = summary.previousMean === null ? null : formatScaleDifference(scale, summary.mean - summary.previousMean);
        return (
          <InsightLine
            key={scale.id}
            icon={scaleIcon(scale)}
            title={scale.name}
            detail={t('insights.scales.list.row', { mean, count: summary.days })}
            spokenDetail={
              t('insights.scales.list.rowSpoken', { mean, count: summary.days }) + (change ? `. ${t('insights.scales.list.changeSpoken', { change })}` : '')
            }
            trailing={
              change ? (
                <AppText variant="caption" muted importantForAccessibility="no">
                  {change}
                </AppText>
              ) : null
            }
            onPress={() => router.push({ pathname: '/scale/[id]', params: { id: String(scale.id), range } })}
          />
        );
      })}
    </InsightCard>
  );
}
