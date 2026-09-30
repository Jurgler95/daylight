import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOUCH_TARGET, radius, spacing, useTheme, withAlpha } from '@/lib/theme';

import { AppText } from './AppText';
import { OptionRow } from './OptionRow';

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

export interface SelectSection {
  /** Shown above the options; leave out for a single ungrouped list. */
  title?: string;
  options: readonly SelectOption[];
}

interface Props {
  /** What is being chosen, e.g. "Vergleich". */
  label: string;
  value: string;
  sections: readonly SelectSection[];
  /** Heading of the sheet; falls back to the label. */
  title?: string;
  closeLabel: string;
  /** Shown in the row while no option matches `value`, e.g. for an action like "Zusammenführen mit". */
  placeholder?: string;
  onChange: (value: string) => void;
}

/**
 * One row that shows the current choice and opens a list of all of them. Used where a row of
 * chips would either grow past the screen or hide options behind a second tap.
 */
export function SelectRow({ label, value, sections, title, closeLabel, placeholder, onChange }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const options = sections.flatMap((section) => section.options);
  const current = options.find((option) => option.value === value);

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder ?? ''}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.row, { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.6 : 1 }]}
      >
        <AppText variant="caption" muted>
          {label}
        </AppText>
        <AppText variant="label" style={styles.value} numberOfLines={1}>
          {current?.label ?? placeholder ?? ''}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: withAlpha(colors.text, 0.35) }]}
          accessibilityLabel={closeLabel}
          onPress={() => setOpen(false)}
        />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.header}>
            <AppText variant="headline" style={styles.headline}>
              {title ?? label}
            </AppText>
            <Pressable
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              style={({ pressed }) => [styles.close, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {sections.map((section, index) => (
              <View key={section.title ?? index} style={styles.section}>
                {section.title ? (
                  <AppText variant="caption" muted style={styles.sectionTitle}>
                    {section.title.toUpperCase()}
                  </AppText>
                ) : null}
                {section.options.map((option) => (
                  <OptionRow
                    key={option.value}
                    label={option.label}
                    hint={option.hint}
                    selected={option.value === value}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

/** Keeps the sheet clear of the status bar even on a short screen. */
const SHEET_MAX_HEIGHT = '80%';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  value: { flex: 1, textAlign: 'right' },
  backdrop: { flex: 1 },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headline: { flex: 1 },
  close: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'flex-end', justifyContent: 'center' },
  list: { paddingBottom: spacing.sm },
  section: { paddingTop: spacing.sm },
  sectionTitle: { letterSpacing: 1, marginBottom: spacing.xs },
});
