import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import { CARD_OPACITY, radius, spacing, useTheme, withAlpha } from '@/lib/theme';

interface Props {
  label: string;
  /** What a screen reader says instead of `label`, e.g. "Durchschnitt Schlaf" for "Ø Schlaf". */
  spokenLabel?: string;
  value: string;
  hint?: string;
  /** Marks the tile whose subject the cards below show, with an accent border. */
  selected?: boolean;
  /** Makes the tile a button, e.g. to pick the scale the cards below show. */
  onPress?: () => void;
}

export function StatTile({ label, spokenLabel, value, hint, selected = false, onPress }: Props) {
  const { colors } = useTheme();
  const a11y = `${spokenLabel ?? label}: ${value}${hint ? `, ${hint}` : ''}`;
  const style = [
    styles.tile,
    { backgroundColor: withAlpha(colors.surface, CARD_OPACITY), borderColor: selected ? colors.accent : 'transparent' },
    onPress ? styles.pickable : null,
  ];
  const content = (
    <>
      <AppText variant="caption" color={selected ? colors.accent : undefined} muted={!selected}>
        {label.toUpperCase()}
      </AppText>
      <AppText variant="title">{value}</AppText>
      {hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </>
  );
  return onPress ? (
    <PressableScale onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={a11y} style={style}>
      {content}
    </PressableScale>
  ) : (
    <View style={style} accessible accessibilityRole="text" accessibilityLabel={a11y}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs, minWidth: 140 },
  // Always there on a pickable tile, transparent while unselected, so picking one never shifts its text.
  pickable: { borderWidth: 1.5 },
});
