import { useTranslation } from 'react-i18next';

import { AppText, Card, Screen } from '@/components/ui';

const PARAGRAPHS = [
  'privacy.intro',
  'privacy.stored',
  'privacy.photos',
  'privacy.health',
  'privacy.network',
  'privacy.leave',
  'privacy.noCloudBackup',
  'privacy.backup',
  'privacy.computed',
  'privacy.reminders',
  'privacy.lockNote',
  'privacy.deleteNote',
];

export default function PrivacyScreen() {
  const { t } = useTranslation();
  return (
    <Screen back title={t('privacy.title')} backLabel={t('common.back')}>
      <Card>
        {PARAGRAPHS.map((key) => (
          <AppText key={key}>{t(key)}</AppText>
        ))}
      </Card>
    </Screen>
  );
}
