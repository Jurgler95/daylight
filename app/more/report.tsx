import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Chip, Screen, Segmented, TextField, ToggleRow } from '@/components/ui';
import { activityLabel } from '@/lib/catalog/catalog';
import { useToday } from '@/lib/dates/useToday';
import { exportErrorMessage } from '@/lib/export/files';
import { upper } from '@/lib/i18n/language';
import {
  activityDays,
  defaultReportOptions,
  hasSleep,
  MAX_CHART_ACTIVITIES,
  REPORT_PERIODS,
  reportWindow,
  scalesWithValues,
  useCreateReport,
  useReportSource,
  type ReportDelivery,
  type ReportOptions,
} from '@/lib/report';
import { spacing } from '@/lib/theme';

function toggled(ids: readonly number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id];
}

/**
 * The report for a doctor or therapist as a PDF. Every choice lives only as long as the screen:
 * a name or a note for the talk should not stay in the app. The PDF is made on the device.
 */
export default function ReportScreen() {
  const { t } = useTranslation();
  const today = useToday();
  const source = useReportSource(today);
  const [options, setOptions] = useState<ReportOptions>(() => defaultReportOptions(source));
  const [busy, setBusy] = useState(false);
  const create = useCreateReport();
  const set = (patch: Partial<ReportOptions>) => setOptions((current) => ({ ...current, ...patch }));

  const counts = useMemo(() => activityDays(source, options.period), [source, options.period]);
  const scales = useMemo(() => scalesWithValues(source, options.period), [source, options.period]);
  const sleepAvailable = useMemo(() => hasSleep(source, options.period), [source, options.period]);
  const groups = useMemo(
    () =>
      source.catalog.groups
        .map((group) => ({
          group,
          activities: source.catalog.activities.filter((activity) => activity.group_id === group.id && (counts.get(activity.id) ?? 0) > 0),
        }))
        .filter((entry) => entry.activities.length > 0),
    [source.catalog, counts],
  );
  const hasEntries = useMemo(() => {
    const { from, to } = reportWindow(options.period, today, null);
    return source.entries.some((entry) => entry.date >= from && entry.date <= to);
  }, [source.entries, options.period, today]);

  const run = (delivery: ReportDelivery) => {
    if (busy) return;
    setBusy(true);
    const chosen = {
      ...options,
      sleep: options.sleep && sleepAvailable,
      scaleIds: options.scaleIds.filter((id) => scales.some((scale) => scale.id === id)),
      chartActivityIds: options.chartActivityIds.filter((id) => counts.has(id)),
    };
    create(source, chosen, delivery)
      .then((done) => {
        if (done && delivery === 'save') Alert.alert(t('settings.saved'));
      })
      .catch((error: unknown) => Alert.alert(t('common.error'), exportErrorMessage(error, t)))
      .finally(() => setBusy(false));
  };

  const atLimit = options.chartActivityIds.filter((id) => counts.has(id)).length >= MAX_CHART_ACTIVITIES;

  return (
    <Screen back title={t('report.screenTitle')} backLabel={t('common.back')}>
      <Card>
        <AppText muted>{t('report.intro')}</AppText>
      </Card>
      <Card>
        <Segmented
          label={t('report.period')}
          options={REPORT_PERIODS.map((value) => ({ value, label: t(`report.periods.${value}`) }))}
          value={options.period}
          onChange={(period) => set({ period })}
        />
        <TextField label={t('report.nameLabel')} value={options.name} onChangeText={(name) => set({ name })} />
        <TextField
          label={t('report.talkingPointsLabel')}
          value={options.talkingPoints}
          placeholder={t('report.talkingPointsPlaceholder')}
          multiline
          onChangeText={(talkingPoints) => set({ talkingPoints })}
        />
      </Card>

      <Card>
        <AppText variant="caption" muted>
          {upper(t('report.content'))}
        </AppText>
        <ToggleRow
          label={t('report.sleepToggle')}
          hint={sleepAvailable ? undefined : t('report.sleepNone')}
          value={options.sleep && sleepAvailable}
          disabled={!sleepAvailable}
          onChange={(sleep) => set({ sleep })}
        />
        <ToggleRow label={t('report.dayListToggle')} value={options.dayList} onChange={(dayList) => set({ dayList })} />
        <ToggleRow label={t('report.notesToggle')} hint={t('report.notesHint')} value={options.notes} disabled={!options.dayList} onChange={(notes) => set({ notes })} />
      </Card>

      {scales.length ? (
        <Card>
          <AppText variant="caption" muted>
            {upper(t('report.scalesLabel'))}
          </AppText>
          <View style={styles.chips}>
            {scales.map((scale) => (
              <Chip key={scale.id} label={scale.name} selected={options.scaleIds.includes(scale.id)} onPress={() => set({ scaleIds: toggled(options.scaleIds, scale.id) })} />
            ))}
          </View>
        </Card>
      ) : null}

      {groups.length ? (
        <Card>
          <AppText variant="caption" muted>
            {upper(t('report.chartActivitiesLabel'))}
          </AppText>
          <AppText variant="caption" muted>
            {t('report.chartActivitiesHint', { max: MAX_CHART_ACTIVITIES })}
          </AppText>
          {groups.map(({ group, activities }) => (
            <View key={group.id} style={styles.group}>
              <AppText variant="caption">{group.name}</AppText>
              <View style={styles.chips}>
                {activities.map((activity) => {
                  const selected = options.chartActivityIds.includes(activity.id);
                  return (
                    <Chip
                      key={activity.id}
                      label={`${activityLabel(source.catalog, activity.id)} · ${counts.get(activity.id) ?? 0}`}
                      selected={selected}
                      onPress={selected || !atLimit ? () => set({ chartActivityIds: toggled(options.chartActivityIds, activity.id) }) : undefined}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {groups.length ? (
        <Card>
          <AppText variant="caption" muted>
            {upper(t('report.tableGroupsLabel'))}
          </AppText>
          <View style={styles.chips}>
            {groups.map(({ group }) => (
              <Chip key={group.id} label={group.name} selected={options.tableGroupIds.includes(group.id)} onPress={() => set({ tableGroupIds: toggled(options.tableGroupIds, group.id) })} />
            ))}
          </View>
        </Card>
      ) : null}

      {!hasEntries ? (
        <Card>
          <AppText muted>{t('report.empty')}</AppText>
        </Card>
      ) : (
        <View style={styles.actions}>
          <Button label={t('report.save')} variant="secondary" onPress={() => run('save')} disabled={busy} style={styles.flex} />
          <Button label={busy ? t('report.creating') : t('report.share')} onPress={() => run('share')} disabled={busy} style={styles.flex} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  group: { gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
