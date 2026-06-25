import type { AppInfo } from '@slate/protocol';
import type { StateCreator } from 'zustand';
import { hasFreshIcon, putCachedIcon } from '@/lib/icons/icon-cache';
import { appsIconMessage, appsListMessage, webSocketTransport } from '@/lib/ws';
import type { RootState } from '@/stores/store';

type AppsRequestState = 'idle' | 'loading' | 'ready' | 'error';

export type AppsSlice = {
  apps: AppInfo[];
  appsState: AppsRequestState;
  appsReqId: string | null;
  iconVersionByBundleId: Record<string, string>;
  iconTickByBundleId: Record<string, number>;
  requestApps: () => void;
  requestIcons: (bundleIds: string[]) => void;
  ingestAppsResponse: (apps: AppInfo[], reId: string | null) => void;
  ingestIconResponse: (bundleId: string, pngBase64: string, iconVersion: string) => void;
};

export const createAppsSlice: StateCreator<RootState, [], [], AppsSlice> = (set, get) => ({
  apps: [],
  appsState: 'idle',
  appsReqId: null,
  iconVersionByBundleId: {},
  iconTickByBundleId: {},

  requestApps: () => {
    if (get().helper?.capabilities.appList !== true) {
      set({ appsState: 'error' });
      return;
    }
    const message = appsListMessage();
    set({ appsState: 'loading', appsReqId: message.id });
    webSocketTransport.send(message);
  },

  // One icon per message; skip ids already cached at the current version.
  requestIcons: (bundleIds) => {
    if (get().helper?.capabilities.appIcons !== true) return;
    const versions = get().iconVersionByBundleId;
    for (const bundleId of bundleIds) {
      const version = versions[bundleId];
      if (version === undefined || hasFreshIcon(bundleId, version)) continue;
      webSocketTransport.send(appsIconMessage([bundleId]));
    }
  },

  ingestAppsResponse: (apps, reId) => {
    if (reId !== null && reId !== get().appsReqId) return;
    const iconVersionByBundleId: Record<string, string> = {};
    for (const app of apps) iconVersionByBundleId[app.bundleId] = app.iconVersion;
    set({ apps, iconVersionByBundleId, appsState: 'ready' });
  },

  ingestIconResponse: (bundleId, pngBase64, iconVersion) => {
    putCachedIcon(bundleId, iconVersion, pngBase64);
    // Bump only this id's tick so only its IconView re-renders, not every mounted icon.
    set((state) => ({
      iconTickByBundleId: {
        ...state.iconTickByBundleId,
        [bundleId]: (state.iconTickByBundleId[bundleId] ?? 0) + 1,
      },
    }));
  },
});
