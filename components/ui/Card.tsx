import { createContext, use, type PropsWithChildren } from 'react';
import { StyleSheet, type ViewProps } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { CARD_OPACITY, radius, spacing, useTheme, withAlpha } from '@/lib/theme';

interface Props extends PropsWithChildren<ViewProps> {
  tone?: 'surface' | 'accent' | 'muted';
}

/**
 * Turned on for a screen whose cards come and go with the selection (Today, the day editor):
 * a new card rises in, a leaving one fades, and the rest glide into their new places instead
 * of jumping. Off everywhere else, so long lists never animate while scrolling.
 */
export const CardMotion = createContext(false);

const ENTER = FadeInDown.duration(180);
const EXIT = FadeOut.duration(100);
const LAYOUT = LinearTransition.duration(180);

export function Card({ tone = 'surface', style, children, ...rest }: Props) {
  const { colors } = useTheme();
  const motion = use(CardMotion);
  const background =
    tone === 'accent' ? colors.accentSoft : tone === 'muted' ? colors.surfaceMuted : colors.surface;
  // A warm outline gives every card a cheerful edge on the cream page; accent cards get a blue one.
  const outline = tone === 'accent' ? withAlpha(colors.accent, 0.25) : withAlpha(colors.border, 0.9);
  return (
    <Animated.View
      {...rest}
      entering={motion ? ENTER : undefined}
      exiting={motion ? EXIT : undefined}
      layout={motion ? LAYOUT : undefined}
      // Slightly translucent, so the logo backdrop shows through; `contrast.test.ts` checks text on the result.
      style={[styles.card, { backgroundColor: withAlpha(background, CARD_OPACITY), borderColor: outline }, style]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1.5, padding: spacing.xl, gap: spacing.md },
});
