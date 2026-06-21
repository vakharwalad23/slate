import { z } from 'zod';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { persistStorage } from '@/lib/storage/mmkv';
import { DeckSchema } from '@/schemas';
import { type AppsSlice, createAppsSlice } from './slices/apps.slice';
import { type ConnectionSlice, createConnectionSlice } from './slices/connection.slice';
import { createDeckSlice, type DeckSlice } from './slices/deck.slice';
import { createDiscoverySlice, type DiscoverySlice } from './slices/discovery.slice';
import { createLogsSlice, type LogsSlice } from './slices/logs.slice';
import { createPairingSlice, type PairingSlice } from './slices/pairing.slice';

export type RootState = ConnectionSlice &
  PairingSlice &
  DeckSlice &
  AppsSlice &
  DiscoverySlice &
  LogsSlice;

const MetaSchema = z.object({
  host: z.string().optional(),
  port: z.number().optional(),
  currentDeckId: z.string().nullable().optional(),
  currentPageId: z.string().nullable().optional(),
});
const DecksSchema = z.object({ decks: z.array(DeckSchema) });

// host/port + decks persist; token lives in secure-store; all live status is re-derived on launch.
export const useStore = create<RootState>()(
  devtools(
    persist(
      (...a) => ({
        ...createConnectionSlice(...a),
        ...createPairingSlice(...a),
        ...createDeckSlice(...a),
        ...createAppsSlice(...a),
        ...createDiscoverySlice(...a),
        ...createLogsSlice(...a),
      }),
      {
        name: 'slate-root',
        storage: persistStorage,
        version: 1,
        partialize: (state) => ({
          host: state.host,
          port: state.port,
          decks: state.decks,
          currentDeckId: state.currentDeckId,
          currentPageId: state.currentPageId,
        }),
        // Validate the persisted blob; a corrupt decks array falls back to the seeded deck, no crash.
        merge: (persisted, current) => {
          const meta = MetaSchema.safeParse(persisted);
          const decks = DecksSchema.safeParse(persisted);
          return {
            ...current,
            ...(meta.success && {
              ...(meta.data.host !== undefined && { host: meta.data.host }),
              ...(meta.data.port !== undefined && { port: meta.data.port }),
              ...(meta.data.currentDeckId !== undefined && {
                currentDeckId: meta.data.currentDeckId,
              }),
              ...(meta.data.currentPageId !== undefined && {
                currentPageId: meta.data.currentPageId,
              }),
            }),
            ...(decks.success && decks.data.decks.length > 0 && { decks: decks.data.decks }),
          };
        },
      },
    ),
    { enabled: __DEV__ },
  ),
);
