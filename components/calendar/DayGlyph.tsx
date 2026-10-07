import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { DAWN } from '@/components/turning/dawn';
import { AppText } from '@/components/ui';
import { isAhead, type CalendarMarker } from '@/lib/calendar/dayLabel';
import { moodColors, useTheme } from '@/lib/theme';

interface Props {
  marker: CalendarMarker | undefined;
  isToday: boolean;
  isFuture: boolean;
  dayOfMonth: number;
}

/** Height of the drawing, so rows around it can be fixed for virtualisation. */
export const DAY_GLYPH_HEIGHT = 58;

/**
 * The drawing of a single day, shared by the month list and the day strip. The mood is shown by
 * colour and icon together, never by colour alone: soft fill with the mood icon = entry,
 * small dot below = several entries, accent ring = today, pale blue disc = past day without entry,
 * small dark badge with a flag = turning point.
 * A future day may carry a hollow ring in the colour of the outlook's level, with the level's icon
 * inside, faint; planned activities take the place of that icon (two at most, a dot for more).
 */
export function DayGlyph({ marker, isToday, isFuture, dayOfMonth }: Props) {
  const { colors } = useTheme();
  if (isAhead(marker)) {
    const ring = marker.outlook ? moodColors[marker.outlook.level].strong : null;
    return (
      <View style={styles.glyph}>
        <AppText variant="caption" color={colors.textMuted}>
          {dayOfMonth}
        </AppText>
        <View style={[styles.circle, ring ? { borderWidth: 2, borderColor: ring } : null]}>
          <View style={styles.planned}>
            {marker.planned.length === 0 && marker.outlook && ring ? (
              <MaterialCommunityIcons name={marker.outlook.icon} size={18} color={ring} style={styles.faint} />
            ) : (
              marker.planned.slice(0, 2).map((plan) => (
                <MaterialCommunityIcons key={plan.icon + plan.name} name={plan.icon} size={marker.planned.length > 1 ? 12 : 16} color={colors.textMuted} />
              ))
            )}
          </View>
        </View>
        <View style={styles.footer}>
          {marker.planned.length > 2 ? <View style={[styles.dot, { backgroundColor: colors.textMuted }]} /> : null}
        </View>
      </View>
    );
  }
  const mood = marker ? moodColors[marker.level] : null;
  return (
    <View style={styles.glyph}>
      <AppText variant="caption" color={isToday ? colors.accent : colors.textMuted} style={isToday && styles.today}>
        {dayOfMonth}
      </AppText>
      <View
        style={[
          styles.circle,
          { backgroundColor: mood ? mood.soft : isFuture ? 'transparent' : colors.border },
          isToday && { borderWidth: 2, borderColor: colors.accent },
        ]}
      >
        {marker && mood ? <MaterialCommunityIcons name={marker.icon} size={20} color={mood.strong} /> : null}
        {marker?.turning ? (
          <View style={[styles.flag, { backgroundColor: DAWN.skyMid, borderColor: colors.background }]}>
            <MaterialCommunityIcons name="flag-variant" size={9} color={DAWN.sun} />
          </View>
        ) : null}
      </View>
      <View style={styles.footer}>
        {marker && mood && marker.count > 1 ? <View style={[styles.dot, { backgroundColor: mood.strong }]} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: { height: DAY_GLYPH_HEIGHT, alignItems: 'center', gap: 2 },
  today: { fontWeight: '700' },
  circle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  footer: { height: 5, alignItems: 'center', justifyContent: 'center' },
  planned: { flexDirection: 'row', gap: 1 },
  faint: { opacity: 0.7 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  // Pinned to the top right of the circle, like a badge.
  flag: { position: 'absolute', top: -3, right: -4, width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
