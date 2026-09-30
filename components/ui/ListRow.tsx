import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { TOUCH_TARGET, spacing, tileColors, useTheme, withAlpha } from '@/lib/theme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  destructive?: boolean;
  iconColor?: string;
  onPress?: () => void;
}

export function ListRow({ icon, label, value, destructive, iconColor, onPress }: Props) {
  const { colors } = useTheme();
  const tint = destructive ? colors.danger : colors.text;
  const tile = tileFor(icon);
  return (
    <PressableScale
      pressedScale={0.98}
      onPress={
        onPress
          ? () => {
              haptics.tap();
              onPress();
            }
          : undefined
      }
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={styles.row}
    >
      <View style={[styles.icon, { backgroundColor: destructive ? withAlpha(colors.danger, 0.12) : tile.soft }]}>
        <Ionicons name={icon} size={18} color={iconColor ?? (destructive ? colors.danger : tile.strong)} />
      </View>
      <AppText style={styles.label} color={tint}>
        {label}
      </AppText>
      {value ? (
        <AppText variant="label" muted>
          {value}
        </AppText>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </PressableScale>
  );
}

/** The same icon always lands on the same crayon colour, so rows keep their colour between visits. */
function tileFor(icon: string) {
  let hash = 0;
  for (const char of icon) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return tileColors[hash % tileColors.length] ?? tileColors[0]!;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET + 8 },
  icon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
});
