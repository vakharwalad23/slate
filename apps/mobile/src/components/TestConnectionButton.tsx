import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { type TestResult, testConnection } from '@/lib/discovery/test-connection';
import { spacing, useTheme } from '@/theme';

const REASON: Record<TestResult['reason'], string> = {
  ok: 'Reachable',
  timeout: 'No response - is the helper running on this Mac?',
  refused: 'Connection refused - check the port',
};

export function TestConnectionButton({
  host,
  port,
  autoRunToken,
}: {
  host: string;
  port: number;
  autoRunToken?: number;
}) {
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

  // Auto-test when the parent bumps the token (host/port blur), but only with a host to probe.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run only on token change, by design.
  useEffect(() => {
    if (autoRunToken === undefined || autoRunToken === 0 || host === '') return;
    run();
  }, [autoRunToken]);

  return (
    <View style={styles.container}>
      <Button title="Test connection" onPress={run} variant="ghost" disabled={busy} />
      {result ? (
        <Text
          variant="caption"
          style={[styles.result, { color: result.ok ? colors.success : colors.danger }]}
        >
          {REASON[result.reason]}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  result: { textAlign: 'center' },
});
