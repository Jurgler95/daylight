import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Screen } from '@/components/ui';
import { RELEASES } from '@/lib/changelog';
import { formatLong, isDateString } from '@/lib/dates';
import { spacing } from '@/lib/theme';

export default function ChangelogScreen() {
  const { t } = useTranslation();
  const current = Constants.expoConfig?.version;

  return (
    <Screen back title={t('changelog.title')} backLabel={t('common.back')}>
      {RELEASES.map((release) => (
        <Card key={release.version} tone={release.version === current ? 'accent' : 'surface'}>
          <View style={styles.header}>
            <AppText variant="headline">{t('changelog.version', { version: release.version })}</AppText>
            <AppText variant="caption" muted>
              {isDateString(release.date) ? formatLong(release.date) : release.date}
            </AppText>
          </View>
          {release.changes.map((change) => (
            <View key={change} style={styles.bullet}>
              <AppText muted>{'•'}</AppText>
              <AppText style={styles.text}>{change}</AppText>
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  bullet: { flexDirection: 'row', gap: spacing.sm },
  text: { flex: 1 },
});
