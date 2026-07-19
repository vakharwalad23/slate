import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toaster } from '@/components/Toaster';
import { assertRng } from '@/lib/secure/crypto/rng';
import { readOrCreateDeviceId } from '@/lib/secure/token-store';
import { setDeviceId } from '@/lib/ws';
import { useStore } from '@/stores/store';
import { ThemeProvider, useTheme } from '@/theme';

function ThemedRoot() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      <Toaster />
    </>
  );
}

export default function RootLayout() {
  // Hydrate the stable deviceId + token before any connect; the bootstrapped flag gates the Connect UI.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        assertRng();
      } catch (e) {
        // Fail closed: a dead CSPRNG must never reach key generation. bootstrapped stays false, so
        // the Connect UI never enables.
        console.warn('slate: CSPRNG self-check failed, refusing to connect', e);
        return;
      }
      const id = await readOrCreateDeviceId();
      if (!active) return;
      setDeviceId(id);
      await useStore.getState().hydrateAuth();
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedRoot />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
