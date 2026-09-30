import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { ICON_SECTIONS } from '@/lib/icons/catalog';
import { TOUCH_TARGET, radius, spacing, useTheme, withAlpha } from '@/lib/theme';

interface Props {
  value: IconName;
  /** Tint of the icon, e.g. the mood colour. */
  color?: string;
  onChange: (icon: IconName) => void;
}

/** A row with the current icon that opens a sheet of all icons on offer. */
export function IconPicker({ value, color, onChange }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const tint = color ?? colors.text;

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('manage.icon')}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
      >
        <AppText style={styles.flex}>{t('manage.icon')}</AppText>
        <View style={[styles.current, { backgroundColor: colors.surfaceMuted }]}>
          <MaterialCommunityIcons name={value} size={24} color={tint} />
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.flex, { backgroundColor: withAlpha(colors.text, 0.35) }]} accessibilityLabel={t('common.close')} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.header}>
            <AppText variant="headline" style={styles.flex}>
              {t('manage.icon')}
            </AppText>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={t('common.close')} style={styles.close}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {ICON_SECTIONS.map((section) => (
              <View key={section.key} style={styles.section}>
                <AppText variant="caption" muted style={styles.sectionTitle}>
                  {t(`icons.${section.key}`).toUpperCase()}
                </AppText>
                <View style={styles.grid}>
                  {section.icons.map((icon) => {
                    const selected = icon === value;
                    return (
                      <Pressable
                        key={icon}
                        onPress={() => {
                          haptics.on();
                          onChange(icon);
                          setOpen(false);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={icon.replace(/-/g, ' ')}
                        style={({ pressed }) => [
                          styles.cell,
                          { backgroundColor: selected ? colors.accentSoft : 'transparent', borderColor: selected ? colors.accent : 'transparent', opacity: pressed ? 0.6 : 1 },
                        ]}
                      >
                        <MaterialCommunityIcons name={icon} size={26} color={selected ? colors.accent : tint} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const CELL = 52;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET + 4 },
  current: { width: TOUCH_TARGET, height: TOUCH_TARGET, borderRadius: TOUCH_TARGET / 2, alignItems: 'center', justifyContent: 'center' },
  sheet: { maxHeight: '80%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  close: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'flex-end', justifyContent: 'center' },
  list: { paddingBottom: spacing.sm },
  section: { paddingTop: spacing.md, gap: spacing.xs },
  sectionTitle: { letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL, height: CELL, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
