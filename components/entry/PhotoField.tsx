import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { PhotoGrid } from '@/components/photo/PhotoGrid';
import { AppText, Button, Card } from '@/components/ui';
import { MAX_PHOTOS, pickPhotos } from '@/lib/photos/pick';

interface Props {
  photos: readonly string[];
  onChange: (photos: string[]) => void;
}

/**
 * The entry's photos, up to `MAX_PHOTOS` from the app; several can be picked at once. An entry from
 * an import may bring more, and all of them stay until removed here. Removing takes effect on
 * "Speichern", like every other change.
 */
export function PhotoField({ photos, onChange }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const room = MAX_PHOTOS - photos.length;

  const add = async () => {
    setBusy(true);
    try {
      const names = await pickPhotos(room);
      if (names.length) onChange([...photos, ...names]);
    } catch (error) {
      Alert.alert(t('photo.failed'), error instanceof Error ? error.message.slice(0, 300) : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <AppText variant="label">{t('photo.title')}</AppText>
      <PhotoGrid
        photos={photos}
        openLabel={t('photo.open')}
        removeLabel={t('photo.remove')}
        onRemove={(name) => onChange(photos.filter((other) => other !== name))}
      />
      {room > 0 ? <Button label={t('photo.add')} variant="secondary" disabled={busy} onPress={() => void add()} /> : null}
    </Card>
  );
}
