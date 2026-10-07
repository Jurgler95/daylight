import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import type { TurningPoint } from '@/db/schema';
import { formatLong, type DateString } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { TOUCH_TARGET, spacing, useTheme } from '@/lib/theme';

import { DAWN } from './dawn';

/** One turning point in the list of "Verlauf"; opens its comparison. */
export function TurningRow({ point }: { point: TurningPoint }) {
  const { colors } = useTheme();
  const date = formatLong(point.date as DateString);
  return (
    <PressableScale
      pressedScale={0.98}
      onPress={() => {
        haptics.tap();
        router.push({ pathname: '/turning/[id]', params: { id: String(point.id) } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${point.title}, ${date}`}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <View style={[styles.badge, { backgroundColor: DAWN.skyMid }]}>
        <MaterialCommunityIcons name="flag-variant" size={18} color={DAWN.sun} />
      </View>
      <View style={styles.text}>
        <AppText variant="label">{point.title}</AppText>
        <AppText variant="caption" muted>
          {date}
        </AppText>
        {point.note ? (
          <AppText variant="caption" numberOfLines={2}>
            {point.note}
          </AppText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET + 12, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
