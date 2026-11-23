import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { InsightCard } from '@/components/insights/InsightCard';
import { LinkRow } from '@/components/insights/LinkRow';
import { AppText, Button } from '@/components/ui';
import { MIN_LINK_PAIRS, type ScaleHealthLink, type ScaleInsight, type ScalePairLink } from '@/lib/insights';

/** Rows before "Alle zeigen" on the cards that can grow with every scale. */
const SHOWN = 6;

/** Every scale against the mood, on the same day and the day after, strongest first. */
export function ScaleMoodLinksCard({ insights }: { insights: readonly ScaleInsight[] }) {
  const { t } = useTranslation();
  const links = insights.flatMap(({ scale, links }) => links.map((link) => ({ scale, ...link }))).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return (
    <InsightCard title={t('insights.scales.relations.mood.title')} empty={links.length === 0 ? t('insights.scales.links.few', { count: MIN_LINK_PAIRS }) : null}>
      {links.map((link) => (
        <LinkRow
          key={`${link.scale.id}:${link.pairing}`}
          title={t(`insights.scales.relations.mood.${link.pairing}`, { scale: link.scale.name })}
          r={link.r}
          pairs={link.pairs}
          sentence={(direction, strength) => t(`insights.scales.links.${link.pairing}.${direction}`, { scale: link.scale.name, strength })}
        />
      ))}
      <AppText variant="caption" muted>
        {t('insights.healthStats.links.hint')}
      </AppText>
    </InsightCard>
  );
}

/** Two scales on the same days: does more energy go with less stress? */
export function ScalePairsCard({ pairs }: { pairs: readonly ScalePairLink[] }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  return (
    <InsightCard title={t('insights.scales.relations.pairs.title')} empty={pairs.length === 0 ? t('insights.scales.relations.empty', { count: MIN_LINK_PAIRS }) : null}>
      {(all ? pairs : pairs.slice(0, SHOWN)).map((link) => (
        <LinkRow
          key={`${link.a.id}:${link.b.id}`}
          title={t('insights.scales.relations.pairs.row', { a: link.a.name, b: link.b.name })}
          r={link.r}
          pairs={link.pairs}
          sentence={(direction, strength) => t(`insights.scales.relations.pairs.${direction}`, { a: link.a.name, b: link.b.name, strength })}
        />
      ))}
      {pairs.length > SHOWN ? <Button variant="ghost" label={t(all ? 'insights.effects.less' : 'insights.effects.more')} onPress={() => setAll(!all)} /> : null}
    </InsightCard>
  );
}

/** Each scale against sleep, steps, pulse and training of the same day; sleep is the night before. */
export function ScaleBodyCard({ links }: { links: readonly ScaleHealthLink[] }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  return (
    <InsightCard title={t('insights.scales.relations.body.title')} empty={links.length === 0 ? t('insights.scales.relations.empty', { count: MIN_LINK_PAIRS }) : null}>
      {(all ? links : links.slice(0, SHOWN)).map((link) => (
        <LinkRow
          key={`${link.scale.id}:${link.metric}`}
          title={t(`insights.scales.relations.body.row.${link.metric}`, { scale: link.scale.name })}
          r={link.r}
          pairs={link.pairs}
          sentence={(direction, strength) => t(`insights.scales.relations.body.${direction}.${link.metric}`, { scale: link.scale.name, strength })}
        />
      ))}
      {links.length > SHOWN ? <Button variant="ghost" label={t(all ? 'insights.effects.less' : 'insights.effects.more')} onPress={() => setAll(!all)} /> : null}
    </InsightCard>
  );
}
