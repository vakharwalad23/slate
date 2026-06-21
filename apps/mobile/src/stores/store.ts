import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { persistStorage } from '@/lib/storage/mmkv';
import { type ConnectionSlice, createConnectionSlice } from './slices/connection.slice';
import { createPairingSlice, type PairingSlice } from './slices/pairing.slice';

export type RootState = ConnectionSlice & PairingSlice;

// Only host/port persist; the token lives in secure-store, and all live status is re-derived on launch.
export const useStore = create<RootState>()(
  devtools(
    persist(
      (...a) => ({
        ...createConnectionSlice(...a),
        ...createPairingSlice(...a),
      }),
      {
        name: 'slate-root',
        storage: persistStorage,
        version: 1,
        partialize: (state) => ({ host: state.host, port: state.port }),
      },
    ),
    { enabled: __DEV__ },
  ),
);
