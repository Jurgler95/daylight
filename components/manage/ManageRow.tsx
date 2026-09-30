import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { spacing, useTheme } from '@/lib/theme';

/** Fixed, so sortable lists can compute drop positions. */
export const MANAGE_ROW_HEIGHT = 52;

interface Props {
  icon?: IconName;
  iconColor?: string;
  label: string;
  /** Right-aligned detail, e.g. "79 Einträge". */
  meta?: string;
  onPress: () => void;
}

/** One mood, activity, group or scale in the management lists. Opens its detail page. */
export function ManageRow({ icon, iconColor, label, meta, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <PressableScale
      pressedScale={0.98}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={meta ? `${label}, ${meta}` : label}
      style={styles.row}
    >
      {icon ? (
        <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
          <MaterialCommunityIcons name={icon} size={20} color={iconColor ?? colors.text} />
        </View>
      ) : null}
      <AppText style={styles.label} numberOfLines={1}>
        {label}
      </AppText>
      {meta ? (
        <AppText variant="caption" muted>
          {meta}
        </AppText>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, height: MANAGE_ROW_HEIGHT, paddingRight: spacing.xs },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
});
