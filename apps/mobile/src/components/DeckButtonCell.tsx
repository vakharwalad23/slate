import { StyleSheet, View } from 'react-native';
import { IconView } from '@/components/IconView';
import { PressableScale, Text } from '@/components/ui';
import type { DeckButton } from '@/schemas';
import { radii, spacing, useTheme } from '@/theme';

// The visual only, no press handling - reused by the static grid and the drag-reorder grid.
export function DeckButtonFace({ button, size }: { button: DeckButton; size: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.cell,
        {
          width: size,
          height: size,
          borderRadius: radii.xl,
          backgroundColor: button.color ?? colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <IconView icon={button.icon} size={Math.round(size * 0.44)} />
      {button.label ? (
        <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.label}>
          {button.label}
        </Text>
      ) : null}
    </View>
  );
}

export function DeckButtonCell({
  button,
  size,
  onPress,
  onLongPress,
}: {
  button: DeckButton;
  size: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} onLongPress={onLongPress}>
      <DeckButtonFace button={button} size={size} />
    </PressableScale>
  );
}

export function AddCell({ size, onPress }: { size: number; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      haptics={false}
      style={[
        styles.cell,
        styles.add,
        { width: size, height: size, borderRadius: radii.xl, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.plus, { color: colors.textDisabled }]}>+</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  cell: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  add: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  plus: { fontSize: 32, fontWeight: '300' },
  label: { textAlign: 'center', width: '100%' },
});
