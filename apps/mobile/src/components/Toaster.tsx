import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, Text } from '@/components/ui';
import { useStore } from '@/stores/store';
import { motion, radii, spacing, useTheme } from '@/theme';

const DISMISS_MS = 2800;
const HIDDEN_Y = 40;

function toastText(error?: string): string {
  if (!error) return 'Command failed';
  if (error === 'not paired') return 'Not connected to the Mac';
  return error;
}

// Surfaces a rejected/failed command (offline reject or a helper ok:false) as a transient box,
// honoring the "never silently drop a command" contract. Reads lastResult so only this re-renders.
export function Toaster() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const lastResult = useStore((s) => s.lastResult);
  const [shown, setShown] = useState(false);
  const [message, setMessage] = useState('');
  const translateY = useSharedValue(HIDDEN_Y);
  const opacity = useSharedValue(0);

  const hide = useCallback(() => {
    translateY.value = withTiming(HIDDEN_Y, { duration: motion.base });
    opacity.value = withTiming(0, { duration: motion.base }, (finished) => {
      if (finished) runOnJS(setShown)(false);
    });
  }, [translateY, opacity]);

  useEffect(() => {
    if (!lastResult || lastResult.ok) return;
    setMessage(toastText(lastResult.error));
    setShown(true);
    translateY.value = withSpring(0, motion.spring);
    opacity.value = withTiming(1, { duration: motion.fast });
    const timer = setTimeout(hide, DISMISS_MS);
    return () => clearTimeout(timer);
  }, [lastResult, hide, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!shown) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + spacing.lg }, animatedStyle]}
    >
      <Pressable onPress={hide}>
        <Surface variant="elevated" radius={radii.lg} style={styles.toast}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.danger} />
          <Text variant="label" numberOfLines={2} style={styles.text}>
            {message}
          </Text>
        </Surface>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    maxWidth: 420,
  },
  text: { flexShrink: 1 },
});
