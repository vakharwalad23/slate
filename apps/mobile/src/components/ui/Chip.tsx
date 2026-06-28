import { StyleSheet } from 'react-native';
import { radii, spacing, useTheme } from '@/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export function Chip({
  label,
  selected = false,
  onPress,
  onLongPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  onLongPress?: (() => void) | undefined;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.accent, borderColor: colors.accent }
          : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text variant="label" tone={selected ? 'onAccent' : 'primary'}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
