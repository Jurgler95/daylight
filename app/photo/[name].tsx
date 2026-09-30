import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Photo } from '@/components/photo/Photo';
import { ZoomableView } from '@/components/photo/ZoomableView';
import { isPhotoName } from '@/lib/photos/store';
import { TOUCH_TARGET, spacing } from '@/lib/theme';

/** A photo on its own, whole and on black. Pinch or double tap to zoom in. */
export default function PhotoScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { name } = useLocalSearchParams<{ name: string }>();
  if (!name || !isPhotoName(name)) return <Redirect href="/" />;

  return (
    <View style={styles.root}>
      <ZoomableView>
        <Photo name={name} fit="contain" style={styles.flex} accessibilityLabel={t('photo.label')} />
      </ZoomableView>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        style={({ pressed }) => [styles.close, { top: insets.top + spacing.sm, opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="close" size={24} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  flex: { flex: 1 },
  close: {
    position: 'absolute',
    right: spacing.lg,
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
