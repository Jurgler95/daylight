import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { StartDateRow } from '@/components/experiments/StartDateRow';
import { AppText, Button, Card, Screen, SelectRow, TextField, ToggleRow } from '@/components/ui';
import { getDb } from '@/db';
import { createExperiment, updateExperiment } from '@/db/repositories/experiments';
import { formatLong, type DateString } from '@/lib/dates';
import { useToday } from '@/lib/dates/useToday';
import {
  cleanTitle,
  DEFAULT_EXPERIMENT_WEEKS,
  endFromStart,
  experimentLength,
  experimentState,
  isDuplicate,
  newDatesProblem,
  newExperimentProblem,
  startBounds,
  type ExperimentProblem,
} from '@/lib/experiments/rules';
import { useExperiment, useExperiments } from '@/lib/experiments/useExperiments';
import { lengthChoices } from '@/lib/experiments/view';
import { haptics } from '@/lib/haptics';
import { mutate } from '@/lib/store/dataVersion';
import { useTheme } from '@/lib/theme';

/**
 * `/experiments/new` sets up an experiment, `?id=` edits one. Title, note and the daily question
 * can always change; start and length only while it is planned or running. A plain page in
 * daylight, no dawn.
 */
export default function ExperimentFormScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const today = useToday();
  const existing = useExperiment(params.id ? Number(params.id) : -1);
  const experiments = useExperiments();
  const editing = !!params.id;
  const initialDays = existing ? experimentLength(existing) : DEFAULT_EXPERIMENT_WEEKS * 7;
  const initialStart = (existing?.start_date ?? today) as DateString;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [start, setStart] = useState<DateString>(initialStart);
  const [days, setDays] = useState(initialDays);
  const [checkIn, setCheckIn] = useState(existing?.check_in ?? false);
  const [tried, setTried] = useState(false);
  const navigation = useNavigation();
  // Set right before a deliberate exit (saved), so the guard below lets it through.
  const leaving = useRef(false);

  const datesOpen = !existing || experimentState(existing, today) !== 'over';
  const datesChanged = start !== initialStart || days !== initialDays;
  const datesProblem: ExperimentProblem | null = !existing
    ? newExperimentProblem({ title, start, days }, today)
    : cleanTitle(title) === null
      ? 'title'
      : datesChanged
        ? newDatesProblem(existing, { start, days }, today)
        : null;
  const problem = datesProblem ?? (isDuplicate(experiments, { title, start_date: start }, existing?.id) ? 'duplicate' : null);
  const bounds = startBounds(today);
  const end = datesOpen ? endFromStart(start, days) : (existing!.end_date as DateString);
  const dirty =
    title !== (existing?.title ?? '') || note !== (existing?.note ?? '') || checkIn !== (existing?.check_in ?? false) || datesChanged;

  usePreventRemove(dirty, ({ data }) => {
    if (leaving.current) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert(existing ? t('entry.unsavedTitle') : t('experiments.form.discardTitle'), undefined, [
      { text: t('entry.keepEditing'), style: 'cancel' },
      { text: t('entry.discard'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  if (editing && !existing) {
    return (
      <Screen back title={t('experiments.form.editTitle')} backLabel={t('common.back')}>
        <AppText muted>{t('experiments.gone')}</AppText>
      </Screen>
    );
  }

  const save = () => {
    if (leaving.current) return;
    setTried(true);
    if (problem) {
      haptics.off();
      return;
    }
    try {
      if (existing) {
        mutate(() =>
          updateExperiment(getDb(), existing.id, { title, note, check_in: checkIn, ...(datesChanged ? { dates: { start_date: start, days } } : {}) }, today),
        );
        haptics.confirm();
        leaving.current = true;
        router.back();
        return;
      }
      const created = mutate(() => createExperiment(getDb(), { title, note, start_date: start, days, check_in: checkIn }, today));
      haptics.confirm();
      leaving.current = true;
      router.replace({ pathname: '/experiments/[id]', params: { id: String(created.id) } });
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : String(error));
    }
  };

  const lengthLabel = (value: number) =>
    value % 7 === 0 ? t('experiments.form.weeks', { count: value / 7 }) : t('experiments.form.days', { count: value });

  return (
    <Screen back title={t(existing ? 'experiments.form.editTitle' : 'experiments.form.newTitle')} backLabel={t('common.back')}>
      <Card>
        <TextField label={t('experiments.form.titleLabel')} value={title} placeholder={t('experiments.form.titlePlaceholder')} onChangeText={setTitle} />
        <TextField label={t('experiments.form.noteLabel')} value={note} placeholder={t('experiments.form.notePlaceholder')} multiline onChangeText={setNote} />
      </Card>
      <Card>
        <StartDateRow label={t('experiments.form.start')} value={start} min={bounds.min} max={bounds.max} disabled={!datesOpen} onChange={setStart} />
        {datesOpen ? (
          <SelectRow
            label={t('experiments.form.length')}
            value={String(days)}
            sections={[{ options: lengthChoices(initialDays).map((value) => ({ value: String(value), label: lengthLabel(value) })) }]}
            closeLabel={t('common.close')}
            onChange={(value) => setDays(Number(value))}
          />
        ) : null}
        <AppText variant="caption" muted>
          {datesOpen ? t('experiments.form.endsOn', { date: formatLong(end) }) : t('experiments.form.datesLocked', { date: formatLong(end) })}
        </AppText>
      </Card>
      {datesOpen ? (
        // Once it is over the editor asks no more (E17), so the switch would change nothing.
        <Card>
          <ToggleRow label={t('experiments.form.checkIn')} hint={t('experiments.form.checkInHint')} value={checkIn} onChange={setCheckIn} />
        </Card>
      ) : null}
      <AppText variant="caption" muted>
        {t('experiments.form.honest')}
      </AppText>
      {tried && problem ? (
        <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {t(`experiments.problem.${problem}`)}
        </AppText>
      ) : null}
      <Button label={t(existing ? 'experiments.form.save' : 'experiments.form.create')} onPress={save} />
    </Screen>
  );
}
