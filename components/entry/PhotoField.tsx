import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Photo } from '@/components/photo/Photo';
import { AppText, Button, Card } from '@/components/ui';
import { pickPhoto } from '@/lib/photos/pick';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  photos: readonly string[];
  onChange: (photos: string[]) => void;
}

/**
 * The entry's photo. One per entry from the app; an entry from Daylio may bring more, and all of
 * them stay until removed here. Removing takes effect on "Speichern", like every other change.
 */
export function PhotoField({ photos, onChange }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      const name = await pickPhoto();
      if (name) onChange([...photos, name]);
    } catch (error) {
      Alert.alert(t('photo.failed'), error instanceof Error ? error.message.slice(0, 300) : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <AppText variant="label">{t('photo.title')}</AppText>
      {photos.map((name) => (
        <View key={name}>
          <Pressable
            onPress={() => router.push({ pathname: '/photo/[name]', params: { name } })}
            accessibilityRole="imagebutton"
            accessibilityLabel={t('photo.open')}
          >
            <Photo name={name} style={[styles.photo, { backgroundColor: colors.surfaceMuted }]} />
          </Pressable>
          <Pressable
            onPress={() => onChange(photos.filter((other) => other !== name))}
            accessibilityRole="button"
            accessibilityLabel={t('photo.remove')}
            hitSlop={spacing.xs}
            style={({ pressed }) => [styles.remove, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      ))}
      {photos.length === 0 ? <Button label={t('photo.add')} variant="secondary" disabled={busy} onPress={() => void add()} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md },
  remove: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
