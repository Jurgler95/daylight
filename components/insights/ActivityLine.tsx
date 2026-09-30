import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { TOUCH_TARGET, spacing, useTheme } from '@/lib/theme';

interface Props {
  activityId: number;
  icon: IconName;
  title: string;
  detail?: string;
  /** Something on the right before the chevron, e.g. a count. */
  trailing?: ReactNode;
}

/** A row naming an activity; tapping opens its detail page, from every card alike. */
export function ActivityLine({ activityId, icon, title, detail, trailing }: Props) {
  const { colors } = useTheme();
  return (
    <PressableScale
      pressedScale={0.98}
      onPress={() => {
        haptics.tap();
        router.push({ pathname: '/activity/[id]', params: { id: String(activityId) } });
      }}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}. ${detail}` : title}
      style={styles.row}
    >
      <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.text} />
      </View>
      <View style={styles.text}>
        <AppText variant="label">{title}</AppText>
        {detail ? (
          <AppText variant="caption" muted>
            {detail}
          </AppText>
        ) : null}
      </View>
      {trailing}
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET, paddingVertical: spacing.xs },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
