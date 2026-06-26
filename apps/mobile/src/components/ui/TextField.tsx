import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { fontSize, radii, spacing, useTheme } from '@/theme';

export function TextField({ style, ...props }: TextInputProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.textDisabled}
      {...props}
      style={[
        {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          color: colors.textPrimary,
          borderRadius: radii.md,
          padding: spacing.md,
          fontSize: fontSize.md,
        },
        style,
      ]}
    />
  );
}
