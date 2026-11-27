import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText, Card, Chip } from '@/components/ui';
import { formatLong, type DateString } from '@/lib/dates';
import { endDateAfterNo } from '@/lib/experiments/rules';
import type { CheckInRow } from '@/lib/entry/useEntryEditor';
import { spacing } from '@/lib/theme';

interface Props {
  rows: CheckInRow[];
  date: DateString;
  onTap: (experimentId: number, kept: boolean) => void;
}

/**
 * "Kept today?" in the entry editor, one line per experiment that asks on the entry's day. A tap on
 * the picked answer takes it back. A "no" ends the experiment, so it asks first; the editor carries
 * it out only with "Speichern".
 */
export function CheckInCard({ rows, date, onTap }: Props) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;

  const no = (row: CheckInRow) => {
    if (row.answer === false) return onTap(row.experiment.id, false);
    Alert.alert(
      t('experiments.checkIn.noTitle'),
      t('experiments.checkIn.noText', { title: row.experiment.title, date: formatLong(endDateAfterNo(row.experiment, date)) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('experiments.checkIn.noConfirm'), style: 'destructive', onPress: () => onTap(row.experiment.id, false) },
      ],
    );
  };

  return (
    <Card>
      {rows.map((row) => (
        <View key={row.experiment.id} style={styles.row}>
          <AppText variant="label">{t('experiments.checkIn.question', { title: row.experiment.title })}</AppText>
          <View style={styles.answers}>
            <Chip label={t('experiments.checkIn.yes')} selected={row.answer === true} onPress={() => onTap(row.experiment.id, true)} />
            <Chip label={t('experiments.checkIn.no')} selected={row.answer === false} onPress={() => no(row)} />
          </View>
          {row.endsOn ? (
            <AppText variant="caption" muted>
              {t('experiments.checkIn.endsOnSave', { date: formatLong(row.endsOn) })}
            </AppText>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm },
  answers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
