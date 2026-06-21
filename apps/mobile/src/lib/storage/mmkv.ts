import AsyncStorage from '@react-native-async-storage/async-storage';
import { createMMKV } from 'react-native-mmkv';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

// MMKV v4 is a Nitro module. If Nitro autolinking fails on SDK 56, fall back to AsyncStorage
// (async, one possible hydration frame) so persistence still works. The icon cache (separate
// MMKV id) is added later and tolerates this fallback by becoming a no-op.
function makeBackend(): StateStorage {
  try {
    const mmkv = createMMKV({ id: 'slate-state' });
    return {
      getItem: (name) => mmkv.getString(name) ?? null,
      setItem: (name, value) => {
        mmkv.set(name, value);
      },
      removeItem: (name) => {
        mmkv.remove(name);
      },
    };
  } catch {
    return {
      getItem: (name) => AsyncStorage.getItem(name),
      setItem: (name, value) => AsyncStorage.setItem(name, value),
      removeItem: (name) => AsyncStorage.removeItem(name),
    };
  }
}

export const persistStorage = createJSONStorage(() => makeBackend());
