import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  /** Horizontal centre in the plot, in pixels. */
  x: number;
  /** Width of the plot, so the box stays inside it. */
  width: number;
  children: ReactNode;
}

/** A small box at the top of a plot with the values of the picked point; it never catches touches. */
export function ChartTooltip({ x, width, children }: Props) {
  const { colors } = useTheme();
  const [own, setOwn] = useState(0);
  const left = Math.max(0, Math.min(width - own, x - own / 2));
  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setOwn(Math.round(e.nativeEvent.layout.width))}
      style={[styles.box, { left, opacity: own > 0 ? 1 : 0, backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    top: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
});
