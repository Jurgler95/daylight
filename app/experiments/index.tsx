import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ExperimentRow } from '@/components/experiments/ExperimentRow';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { useToday } from '@/lib/dates/useToday';
import { useExperiments } from '@/lib/experiments/useExperiments';
import { experimentSections } from '@/lib/experiments/view';
import { upper } from '@/lib/i18n/language';

const SECTIONS = ['running', 'planned', 'over'] as const;

/** Every experiment, in "Läuft", "Geplant" and "Vorbei". Nothing is computed here, only the dates. */
export default function ExperimentsScreen() {
  const { t } = useTranslation();
  const today = useToday();
  const experiments = useExperiments();
  const sections = experimentSections(experiments, today);

  return (
    <Screen back title={t('experiments.title')} backLabel={t('common.back')}>
      {experiments.length === 0 ? (
        <Card tone="muted">
          <AppText>{t('experiments.empty')}</AppText>
        </Card>
      ) : null}
      {SECTIONS.map((section) =>
        sections[section].length > 0 ? (
          <Card key={section}>
            <AppText variant="caption" muted accessibilityRole="header">
              {upper(t(`experiments.section.${section}`))}
            </AppText>
            {sections[section].map((experiment, index) => (
              <ExperimentRow key={experiment.id} experiment={experiment} today={today} last={index === sections[section].length - 1} />
            ))}
          </Card>
        ) : null,
      )}
      <Button label={t('experiments.new')} onPress={() => router.push('/experiments/new')} />
    </Screen>
  );
}
