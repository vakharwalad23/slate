import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion } from '@/theme';

// ponytail: ~30-line press-scale wrapper instead of adding a pressable-scale dependency.
export function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  disabled = false,
  haptics = true,
}: {
  children?: ReactNode;
  onPress?: () => void;
  onLongPress?: (() => void) | undefined;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptics?: boolean;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        scale.value = withSpring(0.96, motion.spring);
        if (haptics) void Haptics.selectionAsync();
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring);
      }}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
