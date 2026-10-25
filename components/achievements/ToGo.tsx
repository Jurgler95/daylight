import { Trans, useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/ui';
import type { AchievementUnit } from '@/lib/achievements';
import { formatCount } from '@/lib/insights';

interface Props {
  unit: AchievementUnit;
  remaining: number;
  color: string;
  /** Font size of the number; the words around it stay a caption. */
  size?: number;
}

/** "noch 12 Tage" with the number large, as a countdown to the next star. */
export function ToGo({ unit, remaining, color, size = 22 }: Props) {
  // The line takes the number's height, or the words around it lose their descenders.
  const lineHeight = Math.round(size * 1.25);
  return (
    <AppText variant="label" color={color} numberOfLines={1} style={{ lineHeight }}>
      <Trans
        i18nKey={`achievements.toGo.${unit}`}
        count={remaining}
        values={{ value: formatCount(remaining) }}
        components={{ n: <AppText variant="title" color={color} style={[styles.number, { fontSize: size, lineHeight }]} /> }}
      />
    </AppText>
  );
}

/** The same words without the markup, for the screen reader. */
export function useToGoText() {
  const { t } = useTranslation();
  return (unit: AchievementUnit, remaining: number) =>
    t(`achievements.toGo.${unit}`, { count: remaining, value: formatCount(remaining) }).replace(/<\/?n>/g, '');
}

const styles = StyleSheet.create({
  number: { fontVariant: ['tabular-nums'] },
});
