import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/stores/store';

export default function PairingScreen() {
  const { authPhase, pairFailureReason, helperName, beginPairing, submitCode } = useStore(
    useShallow((s) => ({
      authPhase: s.authPhase,
      pairFailureReason: s.pairFailureReason,
      helperName: s.helper?.name ?? 'helper',
      beginPairing: s.beginPairing,
      submitCode: s.submitCode,
    })),
  );
  const [code, setCode] = useState('');

  if (authPhase === 'confirming' || authPhase === 'authenticating') {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
        <Text style={styles.status}>Verifying...</Text>
      </View>
    );
  }

  if (authPhase === 'code_entry') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Enter the code</Text>
        <Text style={styles.status}>Type the 6-digit code shown on {helperName}.</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
          autoFocus
        />
        <Button title="Confirm" onPress={() => submitCode(code)} disabled={code.length !== 6} />
      </View>
    );
  }

  // needs_pairing, auth_error, pair_error
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pair with {helperName}</Text>
      {pairFailureReason ? (
        <Text style={styles.err}>Pairing failed: {pairFailureReason}</Text>
      ) : null}
      <Button title="Pair" onPress={beginPairing} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600', textAlign: 'center' },
  status: { fontSize: 14, opacity: 0.6, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
  },
  err: { color: '#c62828', textAlign: 'center', fontSize: 14 },
});
