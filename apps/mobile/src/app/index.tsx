import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/stores/store';

const PAIRING_PHASES = ['needs_pairing', 'code_entry', 'confirming', 'auth_error', 'pair_error'];

export default function HomeScreen() {
  const { status, authPhase, bootstrapped, connect, disconnect } = useStore(
    useShallow((s) => ({
      status: s.status,
      authPhase: s.authPhase,
      bootstrapped: s.bootstrapped,
      connect: s.connect,
      disconnect: s.disconnect,
    })),
  );
  const pathname = usePathname();
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('8765');

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

  const socketUp = status === 'connected';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>slate</Text>
      <Text style={styles.status}>{status}</Text>

      <TextInput
        style={styles.input}
        value={host}
        onChangeText={setHost}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="host"
      />
      <TextInput
        style={styles.input}
        value={port}
        onChangeText={setPort}
        keyboardType="number-pad"
        placeholder="port"
      />
      {socketUp ? (
        <Button title="Disconnect" onPress={disconnect} />
      ) : (
        <Button
          title="Connect"
          onPress={() => connect(host.trim(), Number(port) || 8765)}
          disabled={!bootstrapped}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '600', textAlign: 'center' },
  status: { fontSize: 14, opacity: 0.6, textAlign: 'center', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 16 },
});
