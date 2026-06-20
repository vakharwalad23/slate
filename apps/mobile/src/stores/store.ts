import { create } from 'zustand';
import { type ConnectionSlice, createConnectionSlice } from './slices/connection.slice';

// One root store; later slices (buttons, pairing) spread in here. Middleware (devtools/persist/immer)
// is added with the first persisted slice.
export type RootState = ConnectionSlice;

export const useStore = create<RootState>()((...a) => ({
  ...createConnectionSlice(...a),
}));
