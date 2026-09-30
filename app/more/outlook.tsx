import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useOutlookTexts } from '@/components/outlook/useOutlookTexts';
import { AppText, Card, Screen, ToggleRow } from '@/components/ui';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { useToday } from '@/lib/dates/useToday';
import { formatDecimal } from '@/lib/insights/format';
import { useOutlook } from '@/lib/outlook/useOutlook';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { spacing, useTheme } from '@/lib/theme';

/**
 * The switch, and the backtest in numbers: for each distance, how far off the outlook's middle, the
 * long mean and "always the most frequent mood" were. Whoever wonders why there is no range can
 * see it here.
 */
export default function OutlookSettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const catalog = useCatalog();
  const texts = useOutlookTexts(catalog);
  const { outlook, modeLevel } = useOutlook(useToday());
  if (!settings) return null;
  const scores = outlook?.status === 'ready' ? outlook.backtest.horizons : null;
  const cell = (value: number | null) => (value === null ? '' : formatDecimal(value, 2));

  return (
    <Screen back title={t('settings.outlook')} backLabel={t('common.back')}>
      <Card>
        <ToggleRow label={t('outlook.show')} hint={t('outlook.showHint')} value={settings.outlook_enabled} onChange={(outlook_enabled) => update({ outlook_enabled })} />
      </Card>
      <Card>
        <AppText variant="headline" accessibilityRole="header">
          {t('outlook.accuracy')}
        </AppText>
        {outlook === null ? (
          <AppText muted>{t('outlook.computing')}</AppText>
        ) : !scores || scores.every((h) => h.cases === 0) ? (
          <AppText muted>{t('outlook.accuracyEmpty')}</AppText>
        ) : (
          <>
            <View style={styles.row}>
              <AppText variant="caption" muted style={styles.first} />
              <AppText variant="caption" muted style={styles.cell}>
                {t('outlook.colModel')}
              </AppText>
              <AppText variant="caption" muted style={styles.cell}>
                {t('outlook.colLongMean')}
              </AppText>
              <AppText variant="caption" muted style={styles.cell}>
                {t('outlook.colMode', { mood: texts.mood(modeLevel) })}
              </AppText>
            </View>
            {scores.map((h) => (
              <View
                key={h.horizon}
                style={styles.row}
                accessible
                accessibilityLabel={`${t('outlook.horizon', { count: h.horizon })}: ${t('outlook.colModel')} ${cell(h.model)}, ${t('outlook.colLongMean')} ${cell(h.longMean)}, ${t('outlook.colMode', { mood: texts.mood(modeLevel) })} ${cell(h.mode)}, ${t(h.beats ? 'outlook.shown' : 'outlook.notShown')}`}
              >
                <AppText variant="caption" style={styles.first}>
                  {t('outlook.horizon', { count: h.horizon })}
                </AppText>
                <AppText variant="label" color={h.beats ? colors.accent : colors.text} style={styles.cell}>
                  {cell(h.model)}
                </AppText>
                <AppText style={styles.cell}>{cell(h.longMean)}</AppText>
                <AppText style={styles.cell}>{cell(h.mode)}</AppText>
              </View>
            ))}
            <AppText variant="caption" muted>
              {t('outlook.cases', { count: scores[0]?.cases ?? 0 })}
            </AppText>
            <AppText variant="caption" muted>
              {t('outlook.accuracyHint')}
            </AppText>
          </>
        )}
      </Card>
      <AppText variant="caption" muted>
        {t('outlook.about')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  first: { flex: 1.3 },
  cell: { flex: 1, textAlign: 'right' },
});
