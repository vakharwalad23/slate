import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/stores/store';

export default function HomeScreen() {
  const { status, helper, lastResult, connect, disconnect, sendCommand } = useStore(
    useShallow((s) => ({
      status: s.status,
      helper: s.helper,
      lastResult: s.lastResult,
      connect: s.connect,
      disconnect: s.disconnect,
      sendCommand: s.sendCommand,
    })),
  );
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('8765');
  const [app, setApp] = useState('Safari');

  const connected = helper !== null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>slate</Text>
      <Text style={styles.status}>{connected ? `Connected to ${helper.name}` : status}</Text>

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
      {connected ? (
        <Button title="Disconnect" onPress={disconnect} />
      ) : (
        <Button title="Connect" onPress={() => connect(host.trim(), Number(port) || 8765)} />
      )}

      <View style={styles.divider} />

      <TextInput
        style={styles.input}
        value={app}
        onChangeText={setApp}
        autoCapitalize="words"
        placeholder="app name"
      />
      <Button
        title={`Launch ${app}`}
        onPress={() => sendCommand({ kind: 'launch_app', app })}
        disabled={!connected}
      />

      {lastResult ? (
        <Text style={lastResult.ok ? styles.ok : styles.err}>
          {lastResult.ok ? 'OK' : `Error: ${lastResult.error ?? 'unknown'}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '600', textAlign: 'center' },
  status: { fontSize: 14, opacity: 0.6, textAlign: 'center', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 16 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  ok: { color: '#2e7d32', textAlign: 'center', fontSize: 14 },
  err: { color: '#c62828', textAlign: 'center', fontSize: 14 },
});
