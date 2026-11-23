import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui';
import type { ScaleInsight } from '@/lib/insights';
import { spacing } from '@/lib/theme';

/** The scale the section looks at; falls back to the first one when the range no longer has it. */
export function useScale(insights: readonly ScaleInsight[]): [ScaleInsight | null, (id: number) => void] {
  const [picked, setPicked] = useState<number | null>(null);
  return [insights.find((insight) => insight.scale.id === picked) ?? insights[0] ?? null, setPicked];
}

/** One chip per scale; hidden when there is only one. */
export function ScalePicker({ insights, value, onChange }: { insights: readonly ScaleInsight[]; value: number; onChange: (id: number) => void }) {
  const { t } = useTranslation();
  if (insights.length < 2) return null;
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('insights.scales.pick')}>
      {insights.map(({ scale }) => (
        <Chip key={scale.id} label={scale.name} selected={scale.id === value} onPress={() => onChange(scale.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
