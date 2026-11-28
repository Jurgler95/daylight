import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { useCloseOnLock } from '@/lib/lock/useCloseOnLock';
import { TOUCH_TARGET, spacing, useTheme } from '@/lib/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** The chart, given the height its plot may take. */
  children: (plotHeight: number) => ReactNode;
}

const HEAD = TOUCH_TARGET;
/** Room under the plot for the date axis and the legend. */
const BELOW = 64;

/**
 * A chart on its own, turned sideways so a year of days gets the long edge of the screen. The app
 * itself stays upright; only this sheet is drawn rotated, so the phone is simply held across.
 */
export function ChartFullscreen({ visible, onClose, title, children }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  useCloseOnLock(onClose);

  // The box is laid out landscape and turned a quarter clockwise around its centre.
  const boxWidth = screen.height - insets.top - insets.bottom - spacing.md * 2;
  const boxHeight = screen.width - spacing.md * 2;
  const plotHeight = Math.max(120, boxHeight - HEAD - BELOW - spacing.sm);

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="fade" statusBarTranslucent>
      <View style={[styles.page, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.box,
            {
              width: boxWidth,
              height: boxHeight,
              left: (screen.width - boxWidth) / 2,
              top: insets.top + (screen.height - insets.top - insets.bottom - boxHeight) / 2,
            },
          ]}
        >
          <View style={styles.head}>
            <AppText variant="headline" numberOfLines={1} style={styles.flex}>
              {title ?? ''}
            </AppText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8} style={styles.close}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          {visible ? children(plotHeight) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  box: { position: 'absolute', transform: [{ rotate: '90deg' }], gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', height: HEAD, gap: spacing.sm },
  flex: { flex: 1 },
  close: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
});
