import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'slate.authToken';
const DEVICE_ID_KEY = 'slate.deviceId';

// Process-lifetime mirror of the Keychain token so the reconnect auth path stays synchronous.
let tokenCache: string | null = null;

export function cachedToken(): string | null {
  return tokenCache;
}

export async function hydrateToken(): Promise<string | null> {
  tokenCache = await SecureStore.getItemAsync(TOKEN_KEY);
  return tokenCache;
}

export async function writeToken(token: string): Promise<void> {
  tokenCache = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function deleteToken(): Promise<void> {
  tokenCache = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// deviceId is stable identity: a distinct key so a token wipe (or an MMKV reset) never changes it.
export async function readOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing !== null) return existing;
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  return id;
}
