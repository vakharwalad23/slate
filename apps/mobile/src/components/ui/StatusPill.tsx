import { StyleSheet, View } from 'react-native';
import { radii, spacing, useTheme } from '@/theme';
import { Surface } from './Surface';
import { Text } from './Text';

export type ConnState = 'connected' | 'reconnecting' | 'offline';

export function connState(status: 'connecting' | 'connected' | 'disconnected'): {
  state: ConnState;
  label: string;
} {
  if (status === 'connected') return { state: 'connected', label: 'Connected' };
  if (status === 'connecting') return { state: 'reconnecting', label: 'Reconnecting' };
  return { state: 'offline', label: 'Offline' };
}

export function StatusPill({ state, label }: { state: ConnState; label: string }) {
  const { colors } = useTheme();
  const dot: Record<ConnState, string> = {
    connected: colors.success,
    reconnecting: colors.warning,
    offline: colors.textDisabled,
  };
  return (
    <Surface variant="elevated" radius={radii.pill} style={styles.pill}>
      <View style={[styles.dot, { backgroundColor: dot[state] }]} />
      <Text variant="label" tone="secondary">
        {label}
      </Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
