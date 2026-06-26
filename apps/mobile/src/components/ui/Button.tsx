import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { radii, spacing, useTheme } from '@/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const bg: Record<Variant, string> = {
    primary: colors.accent,
    secondary: colors.surface,
    danger: colors.danger,
    ghost: 'transparent',
  };
  const border: Record<Variant, string> = {
    primary: colors.accent,
    secondary: colors.border,
    danger: colors.danger,
    ghost: 'transparent',
  };
  const tone = variant === 'secondary' ? 'primary' : variant === 'ghost' ? 'accent' : 'onAccent';

  return (
    <PressableScale onPress={onPress} disabled={disabled} haptics={false}>
      <View
        style={[
          styles.base,
          { backgroundColor: bg[variant], borderColor: border[variant] },
          disabled ? styles.disabled : null,
          style,
        ]}
      >
        <Text variant="label" tone={tone}>
          {title}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
});
