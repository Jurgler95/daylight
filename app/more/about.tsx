import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText, Card, ListRow, Logo, Screen } from '@/components/ui';
import { spacing } from '@/lib/theme';

const WEBSITE_URL = 'https://paul-behla.de';
const GITHUB_URL = 'https://github.com/Jurgler95/daylight';

function open(url: string) {
  return () => void Linking.openURL(url).catch(() => undefined);
}

export default function AboutScreen() {
  const { t } = useTranslation();
  return (
    <Screen back title={t('about.title')} backLabel={t('common.back')}>
      <Card>
        <View style={styles.brand}>
          <Logo size={64} />
          <View style={styles.name}>
            <AppText variant="headline">{t('app.name')}</AppText>
            <AppText muted>{t('about.tagline')}</AppText>
          </View>
        </View>
        <AppText variant="caption" muted>
          {t('about.version', { version: Constants.expoConfig?.version ?? '?' })}
        </AppText>
        <AppText variant="caption" muted>
          {t('about.copyright')}
        </AppText>
        <AppText variant="caption" muted>
          {t('about.license')}
        </AppText>
      </Card>
      <Card>
        <ListRow icon="globe-outline" label={t('about.website')} value="paul-behla.de" onPress={open(WEBSITE_URL)} />
        <ListRow icon="logo-github" label={t('about.github')} onPress={open(GITHUB_URL)} />
      </Card>
      <Card tone="muted">
        <AppText>{t('about.disclaimer')}</AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  name: { flex: 1, gap: spacing.xs },
});
