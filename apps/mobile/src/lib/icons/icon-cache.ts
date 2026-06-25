import { iconStore } from '@/lib/storage/mmkv';

// Keyed by bundleId + iconVersion, so an app update (new version) is simply a cache miss -> re-fetch.
function iconKey(bundleId: string, iconVersion: string): string {
  return `${bundleId}::${iconVersion}`;
}

export function getCachedIcon(bundleId: string, iconVersion: string): string | null {
  return iconStore?.getString(iconKey(bundleId, iconVersion)) ?? null;
}

export function putCachedIcon(bundleId: string, iconVersion: string, pngBase64: string): void {
  iconStore?.set(iconKey(bundleId, iconVersion), pngBase64);
}

export function hasFreshIcon(bundleId: string, iconVersion: string): boolean {
  return getCachedIcon(bundleId, iconVersion) !== null;
}

export function iconDataUri(pngBase64: string): string {
  return `data:image/png;base64,${pngBase64}`;
}
