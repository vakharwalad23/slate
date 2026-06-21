import type { StateCreator } from 'zustand';
import { type BrowseHandle, type Found, startBrowse } from '@/lib/discovery/zeroconf';
import type { RootState } from '@/stores/store';

// The browse handle is not serializable, so it lives outside the store.
let handle: BrowseHandle | null = null;

type DiscoveryGate = 'unknown' | 'enabled' | 'disabled';

export type DiscoverySlice = {
  discoveryGate: DiscoveryGate;
  found: Found[];
  scanning: boolean;
  startScan: () => void;
  stopScan: () => void;
};

export const createDiscoverySlice: StateCreator<RootState, [], [], DiscoverySlice> = (
  set,
  get,
) => ({
  discoveryGate: 'unknown',
  found: [],
  scanning: false,

  startScan: () => {
    if (get().scanning) return;
    set({ found: [], scanning: true });
    handle = startBrowse(
      (found) => {
        if (!get().found.some((f) => f.host === found.host && f.port === found.port)) {
          set({ found: [...get().found, found] });
        }
      },
      () => set({ discoveryGate: 'disabled' }),
    );
    set(
      handle === null
        ? { discoveryGate: 'disabled', scanning: false }
        : { discoveryGate: 'enabled' },
    );
  },

  stopScan: () => {
    handle?.stop();
    handle = null;
    set({ scanning: false });
  },
});
