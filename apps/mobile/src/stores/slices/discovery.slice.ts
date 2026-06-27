import type { StateCreator } from 'zustand';
import { probeHelper, scanForHelpers } from '@/lib/discovery/subnet-scan';
import { type BrowseHandle, type Found, startBrowse } from '@/lib/discovery/zeroconf';
import type { RootState } from '@/stores/store';

const SCAN_PORT = 8765;

// Not serializable, so kept outside the store. scanGeneration cancels an in-flight subnet scan.
let handle: BrowseHandle | null = null;
let scanGeneration = 0;

export type DiscoverySlice = {
  found: Found[];
  scanning: boolean;
  startScan: () => void;
  stopScan: () => void;
};

export const createDiscoverySlice: StateCreator<RootState, [], [], DiscoverySlice> = (set, get) => {
  const addFound = (name: string, host: string, port: number) => {
    if (!get().found.some((f) => f.host === host)) {
      set({ found: [...get().found, { name, host, port }] });
    }
  };

  return {
    found: [],
    scanning: false,

    startScan: () => {
      if (get().scanning) return;
      scanGeneration += 1;
      const gen = scanGeneration;
      set({ found: [], scanning: true });

      // Fast path: probe the last-known helper directly before the wide sweep starts; a single clean
      // connection reliably answers where the saturating /24 sweep often starves it.
      const known = get().host;
      if (known.length > 0) {
        void probeHelper(known, SCAN_PORT).then((name) => {
          if (name !== null && gen === scanGeneration) addFound(name, known, SCAN_PORT);
        });
      }

      // mDNS where it works (instant); a no-op where the native module is unavailable.
      handle = startBrowse(
        (found) => {
          if (gen === scanGeneration) addFound(found.name, found.host, found.port);
        },
        () => {},
      );

      // Subnet probe: the reliable path that finds the helper without mDNS.
      void scanForHelpers(
        SCAN_PORT,
        (host, name) => {
          if (gen === scanGeneration) addFound(name, host, SCAN_PORT);
        },
        () => gen !== scanGeneration,
        // Temporary: emitted unconditionally (not __DEV__-gated) so an installed preview APK surfaces
        // the per-pass scan diagnostics in the logs view; removed once the discovery fix lands.
        (d) => {
          if (gen !== scanGeneration) return;
          get().logWarn(
            d.prefix === null
              ? `scan: no Wi-Fi IPv4 after ${d.subnetAttempts} attempts`
              : `scan: prefix=${d.prefix} (resolved on attempt ${d.subnetAttempts}), probed ${d.hostsProbed}, ack=${d.outcomes.helloAck} openTO=${d.outcomes.openTimeout} to=${d.outcomes.timeout} err=${d.outcomes.error}, found=${d.found}`,
          );
        },
      )
        .then((scanned) => {
          if (!scanned && gen === scanGeneration) {
            get().logWarn('no Wi-Fi subnet yet; enter the host manually');
          }
        })
        .catch(() => get().logWarn('network scan failed'))
        .finally(() => {
          if (gen === scanGeneration) set({ scanning: false });
        });
    },

    stopScan: () => {
      scanGeneration += 1;
      handle?.stop();
      handle = null;
      set({ scanning: false });
    },
  };
};
