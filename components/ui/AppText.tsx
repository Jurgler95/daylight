import { Text, type TextProps } from 'react-native';

import { typography, useTheme, type TypographyVariant } from '@/lib/theme';

interface Props extends TextProps {
  variant?: TypographyVariant;
  muted?: boolean;
  color?: string;
}

export function AppText({ variant = 'body', muted, color, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={1.6}
      style={[
        typography[variant],
        { color: color ?? (muted ? colors.textMuted : colors.text) },
        style,
      ]}
    />
  );
}
