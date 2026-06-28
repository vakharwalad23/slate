import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { DiscoveryList } from '@/components/DiscoveryList';
import { TestConnectionButton } from '@/components/TestConnectionButton';
import {
  Button,
  connState,
  Icon,
  PressableScale,
  StatusPill,
  Surface,
  Text,
  TextField,
} from '@/components/ui';
import { ensureLocalNetworkPermission } from '@/lib/permissions/local-network';
import { useStore } from '@/stores/store';
import { radii, spacing, useTheme } from '@/theme';

const PAIRING_PHASES = ['needs_pairing', 'code_entry', 'confirming', 'auth_error', 'pair_error'];

export default function HomeScreen() {
  const { status, authPhase, bootstrapped, connect, disconnect, startScan, stopScan } = useStore(
    useShallow((s) => ({
      status: s.status,
      authPhase: s.authPhase,
      bootstrapped: s.bootstrapped,
      connect: s.connect,
      disconnect: s.disconnect,
      startScan: s.startScan,
      stopScan: s.stopScan,
    })),
  );
  const pathname = usePathname();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Seed from the last successful connection (persisted), not localhost - useless on a phone.
  const [host, setHost] = useState(() => useStore.getState().host);
  const [port, setPort] = useState(() => String(useStore.getState().port));
  const [helperName, setHelperName] = useState<string | null>(null);
  const [testToken, setTestToken] = useState(0);

  const socketUp = status === 'connected';
  // Auto-connect fires at most once per mount, so an explicit Disconnect is not immediately undone.
  const autoConnected = useRef(false);

  // Browse for helpers while idle on this screen; stop once connected or away. For a returning user a
  // last-known host is persisted, so reconnect straight to it (the sweep stays as the moved-IP fallback).
  useEffect(() => {
    if (bootstrapped && !socketUp && pathname === '/') {
      if (!autoConnected.current) {
        autoConnected.current = true;
        const { host: knownHost, port: knownPort } = useStore.getState();
        if (knownHost.length > 0) {
          void ensureLocalNetworkPermission().then((granted) => {
            if (granted && useStore.getState().status !== 'connected')
              connect(knownHost, knownPort);
          });
        }
      }
      startScan();
      return () => stopScan();
    }
    return undefined;
  }, [bootstrapped, socketUp, pathname, startScan, stopScan, connect]);

  // Single nav driver (this root screen stays mounted): pairing -> deck on the phase edges.
  useEffect(() => {
    if (PAIRING_PHASES.includes(authPhase) && pathname === '/') {
      router.push('/pairing');
    } else if (authPhase === 'paired' && pathname === '/pairing') {
      router.back();
    } else if (authPhase === 'paired' && pathname === '/') {
      router.push('/deck');
    } else if (authPhase === 'idle' && pathname === '/deck') {
      router.back();
    }
  }, [authPhase, pathname]);

  const connectTo = (target: string, portNumber: number, name?: string) => {
    void ensureLocalNetworkPermission().then((granted) => {
      if (granted) connect(target, portNumber, name);
    });
  };
  const doConnect = () => connectTo(host.trim(), Number(port) || 8765, helperName ?? undefined);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
            paddingLeft: insets.left + spacing.xl,
            paddingRight: insets.right + spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text variant="title">slate</Text>
            <StatusPill {...connState(status)} />
          </View>
          <PressableScale onPress={() => router.push('/settings')} haptics={false}>
            <Icon name="cog" size={24} color={colors.textSecondary} />
          </PressableScale>
        </View>

        <DiscoveryList
          onSelect={(foundHost, foundPort, name) => {
            setHost(foundHost);
            setPort(String(foundPort));
            setHelperName(name);
            connectTo(foundHost, foundPort, name);
          }}
        />

        <Surface variant="surface" radius={radii.xl} style={styles.card}>
          <Text variant="label" tone="secondary">
            Manual connection
          </Text>
          <TextField
            value={host}
            onChangeText={setHost}
            onBlur={() => setTestToken((t) => t + 1)}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="192.168.x.x"
          />
          <TextField
            value={port}
            onChangeText={setPort}
            onBlur={() => setTestToken((t) => t + 1)}
            keyboardType="number-pad"
            placeholder="port"
          />
          {socketUp ? (
            <Button title="Disconnect" onPress={disconnect} variant="danger" />
          ) : (
            <Button title="Connect" onPress={doConnect} disabled={!bootstrapped} />
          )}
          <TestConnectionButton
            host={host.trim()}
            port={Number(port) || 8765}
            autoRunToken={testToken}
          />
        </Surface>

        <Button title="Logs" onPress={() => router.push('/logs')} variant="ghost" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerLeft: { gap: spacing.md, flex: 1 },
  card: { padding: spacing.lg, gap: spacing.md },
});
