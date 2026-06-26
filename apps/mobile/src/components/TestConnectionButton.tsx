import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { type TestResult, testConnection } from '@/lib/discovery/test-connection';
import { spacing, useTheme } from '@/theme';

export function TestConnectionButton({ host, port }: { host: string; port: number }) {
  const { colors } = useTheme();
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
      <Button title="Test connection" onPress={run} variant="ghost" disabled={busy} />
      {result ? (
        <Text
          variant="caption"
          style={[styles.result, { color: result.ok ? colors.success : colors.danger }]}
        >
          {result.ok ? 'Reachable' : `Not reachable (${result.reason})`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  result: { textAlign: 'center' },
});
