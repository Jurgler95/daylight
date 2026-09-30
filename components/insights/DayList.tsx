import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { MoodBadge } from '@/components/mood/MoodBadge';
import { AppText, Button, PressableScale } from '@/components/ui';
import type { MoodLevel } from '@/db/schema';
import { formatLong, formatShortWithYear, type DateString } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import type { InsightDay } from '@/lib/insights';
import type { IconName } from '@/lib/icons';
import { TOUCH_TARGET, spacing, useTheme } from '@/lib/theme';

const FIRST = 10;

interface Props {
  days: InsightDay[];
  moodFor: (level: MoodLevel) => { label: string; icon: IconName };
  onOpen: (date: DateString) => void;
}

/** Days, newest first, each opening on "Heute"; long lists start short. */
export function DayList({ days, moodFor, onOpen }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [all, setAll] = useState(false);
  return (
    <>
      {(all ? days : days.slice(0, FIRST)).map((day) => {
        const mood = moodFor(day.level);
        return (
          <PressableScale
            key={day.date}
            pressedScale={0.98}
            onPress={() => {
              haptics.tap();
              onOpen(day.date);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${formatLong(day.date)}, ${mood.label}`}
            style={styles.row}
          >
            <MoodBadge level={day.level} icon={mood.icon} size={28} />
            <AppText style={styles.date}>{formatShortWithYear(day.date)}</AppText>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </PressableScale>
        );
      })}
      {!all && days.length > FIRST ? <Button variant="ghost" label={t('insights.activity.showAll', { count: days.length })} onPress={() => setAll(true)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET },
  date: { flex: 1 },
});
