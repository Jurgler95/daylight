import { useTranslation } from 'react-i18next';

import { InsightCard } from '@/components/insights/InsightCard';
import { LinkRow } from '@/components/insights/LinkRow';
import { AppText } from '@/components/ui';
import { MIN_LINK_PAIRS, type HealthLink } from '@/lib/insights';

/** Correlation of each value with the mood, on the same day and one step later. */
export function HealthLinksCard({ links }: { links: HealthLink[] }) {
  const { t } = useTranslation();
  const sorted = [...links].sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return (
    <InsightCard title={t('insights.healthStats.links.title')} empty={sorted.length === 0 ? t('insights.healthStats.links.empty', { count: MIN_LINK_PAIRS }) : null}>
      {sorted.map((link) => (
        <LinkRow
          key={`${link.metric}:${link.pairing}`}
          title={t(`insights.healthStats.links.pairing.${link.metric}.${link.pairing}`)}
          r={link.r}
          pairs={link.pairs}
          sentence={(direction, strength) => t(`insights.healthStats.links.${link.pairing === 'nightAfter' ? 'nightAfter' : link.metric}.${direction}`, { strength })}
        />
      ))}
      <AppText variant="caption" muted>
        {t('insights.healthStats.links.hint')}
      </AppText>
    </InsightCard>
  );
}
