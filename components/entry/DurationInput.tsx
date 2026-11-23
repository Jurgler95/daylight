import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Chip } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { formatDuration } from '@/lib/health/format';
import { DURATION_MAX_MINUTES, DURATION_PRESETS, DURATION_STEP_MINUTES } from '@/lib/scales/duration';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  label: string;
  /** Minutes, or null while nothing is set. */
  value: number | null;
  /** Shown while no value is set. */
  emptyLabel: string;
  onChange: (value: number | null) => void;
}

/**
 * A duration scale: plus and minus in quarter hours, and chips for the usual amounts. Tapping the
 * chip that is set clears the value, so does stepping below zero.
 */
export function DurationInput({ label, value, emptyLabel, onChange }: Props) {
  const { colors } = useTheme();
  const display = value === null ? emptyLabel : formatDuration(value);

  const step = (direction: 1 | -1) => {
    if (value === null) {
      if (direction > 0) {
        haptics.tick();
        onChange(DURATION_STEP_MINUTES);
      }
      return;
    }
    // Off-grid values (from an import) land on the next quarter hour in the direction pressed,
    // one above a full day comes back down to it.
    const quarters = direction > 0 ? Math.floor(value / DURATION_STEP_MINUTES) + 1 : Math.ceil(value / DURATION_STEP_MINUTES) - 1;
    const next = Math.min(quarters * DURATION_STEP_MINUTES, DURATION_MAX_MINUTES);
    if (next < 0) {
      haptics.off();
      return onChange(null);
    }
    if (next <= value && direction > 0) return;
    haptics.tick();
    onChange(next);
  };

  return (
    <View style={styles.root}>
      {/* One adjustable element for TalkBack, like the rating scales; the buttons are for the finger. */}
      <View
        style={styles.header}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: display }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      >
        <AppText variant="label" style={styles.label}>
          {label}
        </AppText>
        <View style={[styles.controls, { backgroundColor: colors.surfaceMuted }]}>
          <Pressable onPress={() => step(-1)} style={styles.button}>
            <Ionicons name="remove" size={20} color={colors.text} />
          </Pressable>
          <AppText variant="label" color={value === null ? colors.textMuted : colors.accent} style={styles.value}>
            {display}
          </AppText>
          <Pressable onPress={() => step(1)} style={styles.button}>
            <Ionicons name="add" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>
      <View style={styles.presets}>
        {DURATION_PRESETS.map((minutes) => (
          <Chip
            key={minutes}
            label={formatDuration(minutes)}
            selected={value === minutes}
            onPress={() => onChange(value === minutes ? null : minutes)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  // With a large font the stepper moves below the name instead of squeezing it.
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  label: { flexShrink: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill },
  button: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 92, textAlign: 'center' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
