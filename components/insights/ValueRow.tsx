import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { spacing } from '@/lib/theme';

interface Props {
  label: string;
  /** The values, e.g. "6,2 → 5,5". */
  detail: string;
  /** A short line under the values, e.g. the verdict of an experiment. */
  note?: string | null;
}

/**
 * A named value pair in one row, the name on the left and the values on the right, as one item for
 * a screen reader. The values may take at most about two thirds of the row, so a long note under them
 * never squeezes the name into broken syllables.
 */
export function ValueRow({ label, detail, note }: Props) {
  return (
    <View style={styles.row} accessible accessibilityLabel={note ? `${label}: ${detail}, ${note}` : `${label}: ${detail}`}>
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>
      <View style={styles.values}>
        <AppText muted style={styles.right}>
          {detail}
        </AppText>
        {note ? (
          <AppText variant="caption" muted style={styles.right}>
            {note}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 32 },
  label: { flex: 1, minWidth: '33%' },
  values: { flexShrink: 1, maxWidth: '67%', alignItems: 'flex-end' },
  right: { textAlign: 'right' },
});
