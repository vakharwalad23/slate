import { StyleSheet, View, type ViewProps } from 'react-native';
import { radii, useTheme } from '@/theme';

type Variant = 'surface' | 'elevated' | 'recessed';

export function Surface({
  variant = 'surface',
  radius = radii.lg,
  bordered = true,
  style,
  ...rest
}: ViewProps & { variant?: Variant; radius?: number; bordered?: boolean }) {
  const { colors, scheme } = useTheme();
  const bg: Record<Variant, string> = {
    surface: colors.surface,
    elevated: colors.elevated,
    recessed: colors.recessed,
  };
  // Depth is a soft shadow in light, luminance + hairline border in dark (shadows barely read on dark).
  const shadow =
    scheme === 'light' && variant === 'elevated'
      ? {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 1,
          shadowRadius: 14,
          elevation: 4,
        }
      : null;
  return (
    <View
      {...rest}
      style={[
        { backgroundColor: bg[variant], borderRadius: radius },
        bordered ? { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border } : null,
        shadow,
        style,
      ]}
    />
  );
}
