import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { IconView } from '@/components/IconView';
import { PressableScale, Text } from '@/components/ui';
import type { DeckButton } from '@/schemas';
import { motion, radii, spacing, useTheme } from '@/theme';

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
  onDoubleTap,
}: {
  button: DeckButton;
  size: number;
  onPress: () => void;
  onLongPress: () => void;
  onDoubleTap?: (() => void) | undefined;
}) {
  // Snappy default path; only buttons with a double-tap action pay the tap-disambiguation delay.
  if (onDoubleTap === undefined) {
    return (
      <PressableScale onPress={onPress} onLongPress={onLongPress}>
        <DeckButtonFace button={button} size={size} />
      </PressableScale>
    );
  }
  return (
    <GestureButton
      button={button}
      size={size}
      onPress={onPress}
      onLongPress={onLongPress}
      onDoubleTap={onDoubleTap}
    />
  );
}

function GestureButton({
  button,
  size,
  onPress,
  onLongPress,
  onDoubleTap,
}: {
  button: DeckButton;
  size: number;
  onPress: () => void;
  onLongPress: () => void;
  onDoubleTap: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // maxDuration(250) so a hold is NOT a tap (it falls through to long-press).
  const single = Gesture.Tap()
    .maxDuration(250)
    .runOnJS(true)
    .onBegin(() => {
      scale.value = withSpring(0.96, motion.spring);
    })
    .onFinalize(() => {
      scale.value = withSpring(1, motion.spring);
    })
    .onEnd((_e, success) => {
      if (success) {
        void Haptics.selectionAsync();
        onPress();
      }
    });
  // maxDelay(280): the single tap waits this long for a second tap, so launch stays reasonably snappy.
  const double = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(280)
    .runOnJS(true)
    .onEnd((_e, success) => {
      if (success) onDoubleTap();
    });
  const long = Gesture.LongPress()
    .minDuration(450)
    .runOnJS(true)
    .onStart(() => onLongPress());

  // Long-press runs alongside the taps (it is temporally distinct); single defers to double via Exclusive.
  const gesture = Gesture.Simultaneous(long, Gesture.Exclusive(double, single));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animatedStyle}>
        <DeckButtonFace button={button} size={size} />
      </Animated.View>
    </GestureDetector>
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
