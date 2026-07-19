import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type DiscoveredHelper = { host: string; port: number; name: string };

type SlateDiscoveryNativeModule = {
  discover(port: number, timeoutMs: number): Promise<DiscoveredHelper[]>;
};

// Android-only: a UDP broadcast probe answered unicast by the helper (no MulticastLock needed). On
// every other platform this is null and callers fall back to Bonjour + the subnet sweep.
let native: SlateDiscoveryNativeModule | null = null;
if (Platform.OS === 'android') {
  try {
    native = requireNativeModule<SlateDiscoveryNativeModule>('SlateDiscovery');
  } catch {
    native = null;
  }
}

export const isUdpDiscoverySupported = native !== null;

// Broadcast a probe and collect helper replies for up to timeoutMs. Never throws - resolves [] if the
// native module is absent or discovery fails, so callers can rely on the sweep fallback.
export async function discoverHelpers(
  port: number,
  timeoutMs: number,
): Promise<DiscoveredHelper[]> {
  if (native === null) return [];
  try {
    return await native.discover(port, timeoutMs);
  } catch {
    return [];
  }
}
