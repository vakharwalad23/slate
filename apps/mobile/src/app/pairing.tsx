import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { QrScanner } from '@/components/QrScanner';
import { Button, Icon, Surface, Text, TextField } from '@/components/ui';
import { useStore } from '@/stores/store';
import { fontSize, radii, spacing, useTheme } from '@/theme';

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// The helper QR encodes slate://pair?h=<host>&p=<port>&c=<code>; only the code is needed once
// connected. Parsed by hand to avoid depending on a URL polyfill under Hermes.
function pairingCodeFromQR(data: string): string | null {
  const match = /^slate:\/\/pair\?(.*)$/.exec(data);
  if (match === null) return null;
  for (const part of (match[1] ?? '').split('&')) {
    const [key, value] = part.split('=');
    if (key === 'c' && value !== undefined && value.length > 0) return decodeURIComponent(value);
  }
  return null;
}

function Screen({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left + spacing.xl,
          paddingRight: insets.right + spacing.xl,
        },
      ]}
    >
      {children}
    </View>
  );
}

export default function PairingScreen() {
  const { authPhase, pairFailureReason, pairExpiresAt, helperName, beginPairing, submitCode } =
    useStore(
      useShallow((s) => ({
        authPhase: s.authPhase,
        pairFailureReason: s.pairFailureReason,
        pairExpiresAt: s.pairExpiresAt,
        helperName: s.helper?.name ?? 'helper',
        beginPairing: s.beginPairing,
        submitCode: s.submitCode,
      })),
    );
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [scanning, setScanning] = useState(false);

  const onScan = (data: string) => {
    const scanned = pairingCodeFromQR(data);
    if (scanned === null) return;
    setScanning(false);
    setCode(scanned);
    submitCode(scanned);
  };

  useEffect(() => {
    if (authPhase !== 'code_entry') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [authPhase]);

  if (authPhase === 'confirming' || authPhase === 'authenticating') {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
        <Text variant="body" tone="secondary" style={styles.center}>
          Verifying...
        </Text>
      </Screen>
    );
  }

  if (authPhase === 'code_entry') {
    return (
      <Screen>
        <Surface variant="elevated" radius={radii.xl} style={styles.card}>
          <Icon name="lock" size={36} color={colors.accent} />
          <Text variant="title" style={styles.center}>
            Scan to pair
          </Text>
          <Text variant="body" tone="secondary" style={styles.center}>
            Scan the QR on {helperName}, or enter the code below it.
          </Text>
          <Button title="Scan QR" onPress={() => setScanning(true)} style={styles.fullWidth} />
          {pairExpiresAt !== null ? (
            <Text variant="caption" tone="secondary" style={[styles.center, styles.tabular]}>
              Expires in {formatRemaining(pairExpiresAt - now)} - a new code appears automatically.
            </Text>
          ) : null}
          <TextField
            style={styles.codeInput}
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={40}
            placeholder="or paste the code"
          />
          <Button
            title="Confirm code"
            variant="secondary"
            onPress={() => submitCode(code)}
            disabled={code.trim().length < 16}
            style={styles.fullWidth}
          />
          <QrScanner visible={scanning} onClose={() => setScanning(false)} onScan={onScan} />
        </Surface>
      </Screen>
    );
  }

  // needs_pairing, auth_error, pair_error
  return (
    <Screen>
      <Surface variant="elevated" radius={radii.xl} style={styles.card}>
        <Icon name="lock-open" size={36} color={colors.accent} />
        <Text variant="title" style={styles.center}>
          Pair with {helperName}
        </Text>
        {pairFailureReason ? (
          <Text tone="danger" style={styles.center}>
            Pairing failed: {pairFailureReason}
          </Text>
        ) : null}
        <Text variant="body" tone="secondary" style={styles.center}>
          You will enter the pairing code shown under the QR on your Mac.
        </Text>
        <Button title="Pair" onPress={beginPairing} style={styles.fullWidth} />
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  center: { textAlign: 'center' },
  fullWidth: { width: '100%' },
  codeInput: {
    width: '100%',
    textAlign: 'center',
    fontSize: fontSize.lg,
    letterSpacing: 2,
    paddingVertical: spacing.lg,
  },
  tabular: { fontVariant: ['tabular-nums'] },
});
