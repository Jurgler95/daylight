import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { InsightCard } from '@/components/insights/InsightCard';
import { AppText, Button } from '@/components/ui';
import type { DateString } from '@/lib/dates';
import { useExperiments } from '@/lib/experiments/useExperiments';
import { experimentSections } from '@/lib/experiments/view';

import { ExperimentRow } from './ExperimentRow';

/**
 * "Experimente" on top of the mood section of "Einblicke": the running ones with how far they
 * are, otherwise an invitation. Only dates, no comparison is computed here.
 */
export function ExperimentsCard({ today }: { today: DateString }) {
  const { t } = useTranslation();
  const experiments = useExperiments();
  const running = experimentSections(experiments, today).running;
  const all =
    experiments.length > 0 ? <Button variant="ghost" label={t('experiments.card.all')} onPress={() => router.push('/experiments')} /> : undefined;

  return (
    <InsightCard title={t('experiments.title')} action={all}>
      {running.length > 0 ? (
        running.map((experiment, index) => <ExperimentRow key={experiment.id} experiment={experiment} today={today} last={index === running.length - 1} />)
      ) : (
        <>
          <AppText muted>{t('experiments.card.invite')}</AppText>
          <Button variant="secondary" label={t('experiments.new')} onPress={() => router.push('/experiments/new')} />
        </>
      )}
    </InsightCard>
  );
}
