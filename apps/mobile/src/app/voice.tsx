import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { Button, Surface, Text } from '@/components/ui';
import type { CallState, EndReason } from '@/lib/voice/call-state';
import { useStore } from '@/stores/store';
import { spacing, useTheme } from '@/theme';

function endReasonLabel(reason: EndReason | null): string {
  switch (reason) {
    case 'user_hangup':
      return 'you ended the call';
    case 'remote_hangup':
      return 'the other side ended the call';
    case 'socket_drop':
      return 'connection to the Mac was lost';
    case 'ice_failed':
      return 'could not connect';
    case null:
      return 'unknown reason';
  }
}

function statusLabel(call: CallState): string {
  switch (call.status) {
    case 'idle':
      return 'Not on a call';
    case 'offering':
      return 'Calling...';
    case 'connecting':
      return 'Connecting...';
    case 'in_call':
      return 'In call';
    case 'ended':
      return `Call ended - ${endReasonLabel(call.endReason)}`;
  }
}

export default function VoiceScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { call, startCall, endCall, voiceIntercom } = useStore(
    useShallow((s) => ({
      call: s.call,
      startCall: s.startCall,
      endCall: s.endCall,
      // hello_ack is the only place capabilities are known; no helper means the flag defaults false.
      voiceIntercom: s.helper?.capabilities.voiceIntercom ?? false,
    })),
  );

  const active =
    call.status === 'offering' || call.status === 'connecting' || call.status === 'in_call';

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left + spacing.lg,
          paddingRight: insets.right + spacing.lg,
        },
      ]}
    >
      <View style={styles.header}>
        <Text variant="title">Voice</Text>
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </View>

      <View style={styles.content}>
        <Surface variant="surface" style={styles.card}>
          <Text variant="heading">{statusLabel(call)}</Text>
          {!voiceIntercom && (
            <Text variant="caption" tone="secondary">
              This Mac does not advertise voice intercom support.
            </Text>
          )}
          {call.status === 'ended' && call.endReason === 'ice_failed' && (
            <Text variant="caption" tone="danger">
              Could not connect. slate voice needs both devices on the same Wi-Fi - guest networks,
              AP/client isolation, and phone-on-cellular are not supported.
            </Text>
          )}
        </Surface>

        {active ? (
          <Button title="End call" variant="danger" onPress={() => endCall('user_hangup')} />
        ) : (
          <Button
            title="Start call"
            onPress={startCall}
            disabled={!voiceIntercom || call.status === 'ended'}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  content: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  card: { padding: spacing.lg, gap: spacing.sm },
});
