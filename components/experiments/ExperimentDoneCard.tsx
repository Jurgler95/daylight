import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { getDb } from '@/db';
import { markExperimentSeen } from '@/db/repositories/experiments';
import type { DateString } from '@/lib/dates';
import { useFinishedExperiment } from '@/lib/experiments/useExperiments';
import { mutate } from '@/lib/store/dataVersion';
import { spacing } from '@/lib/theme';

/**
 * A small card on "Heute" once an experiment is over (`finishedToShow` in `lib/experiments/view.ts`):
 * the way to its comparison, which marks it seen, or "Schließen", which does the same.
 */
export function ExperimentDoneCard({ today }: { today: DateString }) {
  const { t } = useTranslation();
  const experiment = useFinishedExperiment(today);
  if (!experiment) return null;
  const id = experiment.id;

  return (
    <Card tone="muted">
      <AppText variant="headline" accessibilityRole="header">
        {t('experiments.done.title', { title: experiment.title })}
      </AppText>
      <View style={styles.actions}>
        <Button
          label={t('experiments.done.open')}
          variant="secondary"
          onPress={() => router.push({ pathname: '/experiments/[id]', params: { id: String(id) } })}
        />
        <Button label={t('common.close')} variant="ghost" onPress={() => mutate(() => markExperimentSeen(getDb(), id))} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
