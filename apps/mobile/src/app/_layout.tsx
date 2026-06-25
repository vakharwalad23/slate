import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { readOrCreateDeviceId } from '@/lib/secure/token-store';
import { setDeviceId } from '@/lib/ws';
import { useStore } from '@/stores/store';

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

  return <Stack screenOptions={{ headerShown: false }} />;
}
