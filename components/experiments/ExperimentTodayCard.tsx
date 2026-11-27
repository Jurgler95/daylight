import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, PressableScale } from '@/components/ui';
import type { DateString } from '@/lib/dates';
import { experimentProgress } from '@/lib/experiments/rules';
import { useExperiments } from '@/lib/experiments/useExperiments';
import { experimentSections } from '@/lib/experiments/view';
import { haptics } from '@/lib/haptics';
import { upper } from '@/lib/i18n/language';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

/**
 * On "Heute", one card per running self-experiment: its title, "Tag 5 von 14" with a thin bar, and
 * the way to the interim comparison. Nothing when none runs; the way to start one is
 * `ExperimentStartRow`, next to "Wendepunkt setzen".
 */
export function ExperimentTodayCard({ today }: { today: DateString }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const running = experimentSections(useExperiments(), today).running;
  if (running.length === 0) return null;

  return (
    <>
      {running.map((experiment) => {
        const { day, total } = experimentProgress(experiment, today);
        return (
          <Card key={experiment.id} tone="accent">
            <PressableScale
              pressedScale={0.98}
              onPress={() => {
                haptics.tap();
                router.push({ pathname: '/experiments/[id]', params: { id: String(experiment.id) } });
              }}
              accessibilityRole="button"
              accessibilityLabel={t('experiments.today.a11y', { title: experiment.title, day, total })}
              style={styles.row}
            >
              <View style={[styles.icon, { backgroundColor: colors.accent }]}>
                <Ionicons name="flask-outline" size={20} color={colors.textOnAccent} />
              </View>
              <View style={styles.text}>
                <AppText variant="caption" color={colors.accent} style={styles.eyebrow}>
                  {upper(t('experiments.one'))}
                </AppText>
                <AppText variant="headline">{experiment.title}</AppText>
                <AppText variant="caption" muted>
                  {t('experiments.progress', { day, total })}
                </AppText>
                <View style={[styles.track, { backgroundColor: colors.surface }]}>
                  <View style={[styles.fill, { backgroundColor: colors.accent, width: `${Math.round((day / total) * 100)}%` }]} />
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </PressableScale>
          </Card>
        );
      })}
    </>
  );
}

/** Whether "Selbstversuch starten" belongs on "Heute": none runs and none is planned. */
export function useOffersExperimentStart(today: DateString): boolean {
  const sections = experimentSections(useExperiments(), today);
  return sections.running.length === 0 && sections.planned.length === 0;
}

/** The quiet row "Selbstversuch starten", shown in the muted card under "Wendepunkt setzen". */
export function ExperimentStartRow() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <PressableScale
      pressedScale={0.98}
      onPress={() => {
        haptics.tap();
        router.push('/experiments/new');
      }}
      accessibilityRole="button"
      style={styles.startRow}
    >
      <Ionicons name="flask-outline" size={20} color={colors.accent} />
      <View style={styles.text}>
        <AppText variant="label">{t('experiments.today.start')}</AppText>
        <AppText variant="caption" muted>
          {t('experiments.today.startHint')}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  eyebrow: { letterSpacing: 2 },
  track: { height: 6, borderRadius: radius.sm, overflow: 'hidden', marginTop: spacing.xs },
  fill: { height: '100%', borderRadius: radius.sm },
  startRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET },
});
