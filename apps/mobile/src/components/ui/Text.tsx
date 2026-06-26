import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { fontSize, fontWeight, useTheme } from '@/theme';

type Variant = 'title' | 'heading' | 'body' | 'label' | 'caption';
type Tone = 'primary' | 'secondary' | 'accent' | 'danger' | 'onAccent';

const VARIANTS: Record<Variant, TextStyle> = {
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  heading: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  body: { fontSize: fontSize.md, fontWeight: fontWeight.regular },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  caption: { fontSize: fontSize.xs, fontWeight: fontWeight.regular },
};

export function Text({
  variant = 'body',
  tone = 'primary',
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const { colors } = useTheme();
  const toneColor: Record<Tone, string> = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    accent: colors.accent,
    danger: colors.danger,
    onAccent: colors.onAccent,
  };
  return <RNText {...rest} style={[VARIANTS[variant], { color: toneColor[tone] }, style]} />;
}
