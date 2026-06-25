import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { type TestResult, testConnection } from '@/lib/discovery/test-connection';

export function TestConnectionButton({ host, port }: { host: string; port: number }) {
  const [result, setResult] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState(false);

  const run = () => {
    setBusy(true);
    setResult(null);
    void testConnection(host, port).then((r) => {
      setResult(r);
      setBusy(false);
    });
  };

  return (
    <View style={styles.container}>
      <Button title="Test connection" onPress={run} disabled={busy} />
      {result ? (
        <Text style={result.ok ? styles.ok : styles.err}>
          {result.ok ? 'Reachable' : `Not reachable (${result.reason})`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  ok: { color: '#2e7d32', textAlign: 'center', fontSize: 13 },
  err: { color: '#c62828', textAlign: 'center', fontSize: 13 },
});
