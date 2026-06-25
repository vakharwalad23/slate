import AsyncStorage from '@react-native-async-storage/async-storage';
import { createMMKV } from 'react-native-mmkv';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

type MmkvInstance = ReturnType<typeof createMMKV>;

// MMKV v4 is a Nitro module. If Nitro autolinking fails on SDK 56, both instances are null: persisted
// state falls back to AsyncStorage and the icon cache becomes a no-op (icons just re-fetch over WS).
let stateMmkv: MmkvInstance | null = null;
let iconMmkv: MmkvInstance | null = null;
try {
  stateMmkv = createMMKV({ id: 'slate-state' });
  iconMmkv = createMMKV({ id: 'slate-icons' });
} catch {
  stateMmkv = null;
  iconMmkv = null;
}

function backend(state: MmkvInstance | null): StateStorage {
  if (state) {
    return {
      getItem: (name) => state.getString(name) ?? null,
      setItem: (name, value) => {
        state.set(name, value);
      },
      removeItem: (name) => {
        state.remove(name);
      },
    };
  }
  return {
    getItem: (name) => AsyncStorage.getItem(name),
    setItem: (name, value) => AsyncStorage.setItem(name, value),
    removeItem: (name) => AsyncStorage.removeItem(name),
  };
}

export const persistStorage = createJSONStorage(() => backend(stateMmkv));

// Separate namespace so clearing the icon cache never touches persisted prefs/decks.
export const iconStore = iconMmkv;
