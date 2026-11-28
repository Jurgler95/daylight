import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { upper } from '@/lib/i18n/language';
import { linkFactorKey, MIN_LINK_DAYS, type LinkFinding, type Links } from '@/lib/insights';
import type { IconName } from '@/lib/icons';
import { TOUCH_TARGET, spacing, useTheme } from '@/lib/theme';

import { ActivityLine } from './ActivityLine';
import { METRIC_ICONS } from './health/metrics';
import { InsightCard } from './InsightCard';
import type { ActivityNames } from './names';

interface Props {
  /** Null while the first result is computed. */
  links: Links | null;
  names: ActivityNames;
  scaleName: (id: number) => string;
}

const LAGS = [0, 1] as const;
const LEVELS = ['stable', 'hint'] as const;
/** Rows of what describes the mood before "Alle zeigen": a group of feelings easily fills a screen. */
const SHOWN = 4;

/**
 * Activities, scales, sleep and steps that go together with better or worse days, on the same day
 * and on the day after. Two grades, "stabil" and "Hinweis", and apart from them whatever is marked
 * as describing the mood. A row names the direction and the days behind it, never a strength, and
 * the card says in words that going together is not a cause.
 */
export function LinksCard({ links, names, scaleName }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [all, setAll] = useState(false);
  const title = t('insights.links.title');
  if (!links) return <InsightCard title={title} empty={t('outlook.computing')} />;
  if (links.days < MIN_LINK_DAYS) return <InsightCard title={title} empty={t('insights.links.few', { days: MIN_LINK_DAYS })} />;

  const row = (finding: LinkFinding) => {
    const { factor } = finding;
    const direction = t(`insights.links.${factor.kind === 'activity' ? 'activity' : 'value'}.${finding.direction}${finding.lag}`);
    const detail = t('insights.links.row', { direction, days: t('insights.days', { count: finding.days }) });
    const key = `${linkFactorKey(factor)}-${finding.lag}`;
    if (factor.kind === 'activity') {
      return <ActivityLine key={key} activityId={factor.id} icon={names.icon(factor.id)} title={names.label(factor.id)} detail={detail} />;
    }
    const name = factor.kind === 'scale' ? scaleName(factor.id) : t(`insights.healthStats.metric.${factor.metric}`);
    const icon: IconName = factor.kind === 'scale' ? 'tune-vertical' : METRIC_ICONS[factor.metric];
    return (
      <View key={key} style={styles.row} accessible accessibilityLabel={`${name}. ${detail}`}>
        <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
          <MaterialCommunityIcons name={icon} size={18} color={colors.text} />
        </View>
        <View style={styles.text}>
          <AppText variant="label">{name}</AppText>
          <AppText variant="caption" muted>
            {detail}
          </AppText>
        </View>
      </View>
    );
  };
  const list = (heading: string, findings: LinkFinding[]) =>
    findings.length ? (
      <View key={heading} style={styles.list}>
        <AppText variant="caption" muted>
          {upper(heading)}
        </AppText>
        {findings.map(row)}
      </View>
    ) : null;
  // Only the stable ones: a hint among them would read like the rest of the list.
  const describing = links.describing.filter((finding) => finding.level === 'stable');
  const nothing = links.findings.length + describing.length === 0;

  return (
    <InsightCard title={title} empty={nothing ? t('insights.links.nothing') : null}>
      <AppText variant="caption" muted>
        {t('insights.links.window')}
      </AppText>
      <AppText variant="caption" muted>
        {t('insights.links.explain')}
      </AppText>
      {LAGS.map((lag) => {
        const found = links.findings.filter((finding) => finding.lag === lag);
        if (found.length === 0) return null;
        return (
          <View key={lag} style={styles.section}>
            <AppText variant="label" accessibilityRole="header">
              {t(lag ? 'insights.links.nextDay' : 'insights.links.sameDay')}
            </AppText>
            {LEVELS.map((level) =>
              list(
                t(`insights.links.${level}`),
                found.filter((finding) => finding.level === level),
              ),
            )}
          </View>
        );
      })}
      {describing.length ? (
        <View style={styles.section}>
          <AppText variant="label" accessibilityRole="header">
            {t('insights.links.describing')}
          </AppText>
          <AppText variant="caption" muted>
            {t('insights.links.describingHint')}
          </AppText>
          <View style={styles.list}>{(all ? describing : describing.slice(0, SHOWN)).map(row)}</View>
          {describing.length > SHOWN ? <Button variant="ghost" label={t(all ? 'insights.effects.less' : 'insights.effects.more')} onPress={() => setAll(!all)} /> : null}
        </View>
      ) : null}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs, paddingTop: spacing.sm },
  list: { gap: spacing.xs },
  // Same measures as `ActivityLine`, so a scale lines up with the activities around it.
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET, paddingVertical: spacing.xs },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
