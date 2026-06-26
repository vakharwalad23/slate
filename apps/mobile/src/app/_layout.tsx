import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toaster } from '@/components/Toaster';
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
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedRoot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
