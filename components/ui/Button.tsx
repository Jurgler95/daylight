import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type PressableProps, type ViewStyle } from 'react-native';

import { haptics } from '@/lib/haptics';
import { TOUCH_TARGET, radius, spacing, sunnyGradient, useTheme } from '@/lib/theme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

interface Props extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: ViewStyle;
}

export function Button({ label, variant = 'primary', disabled, style, onPress, accessibilityLabel = label, ...rest }: Props) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  const background = variant === 'secondary' ? colors.accentSoft : 'transparent';
  const text = primary ? colors.textOnAccent : colors.accent;

  return (
    <PressableScale
      {...rest}
      disabled={disabled}
      pressedScale={0.94}
      onPress={(event) => {
        haptics.tap();
        onPress?.(event);
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.base,
        { backgroundColor: background, opacity: disabled ? 0.4 : 1 },
        primary && !disabled && [styles.glow, { shadowColor: colors.accent }],
        style,
      ]}
    >
      {primary ? (
        <LinearGradient colors={sunnyGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      ) : null}
      <AppText variant="label" color={text}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET + 8,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glow: { elevation: 6, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
});
