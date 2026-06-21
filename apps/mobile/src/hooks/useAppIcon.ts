import { useEffect } from 'react';
import { getCachedIcon, iconDataUri } from '@/lib/icons/icon-cache';
import { useStore } from '@/stores/store';

// Returns a data: uri for the app icon, fetching it lazily on a cache miss. Re-renders when a new
// icon lands (subscribing to iconTick) so the cached read below re-runs.
export function useAppIcon(bundleId: string): string | null {
  const iconVersion = useStore((s) => s.iconVersionByBundleId[bundleId]);
  const requestIcons = useStore((s) => s.requestIcons);
  useStore((s) => s.iconTick);

  useEffect(() => {
    if (iconVersion !== undefined && getCachedIcon(bundleId, iconVersion) === null) {
      requestIcons([bundleId]);
    }
  }, [bundleId, iconVersion, requestIcons]);

  if (iconVersion === undefined) return null;
  const cached = getCachedIcon(bundleId, iconVersion);
  return cached === null ? null : iconDataUri(cached);
}
