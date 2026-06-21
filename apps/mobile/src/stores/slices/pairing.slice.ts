import type { MessageOf } from '@slate/protocol';
import type { StateCreator } from 'zustand';
import { cachedToken, deleteToken, hydrateToken, writeToken } from '@/lib/secure/token-store';
import { authMessage, pairConfirmMessage, pairRequestMessage, webSocketTransport } from '@/lib/ws';
import type { RootState } from '@/stores/store';

export type AuthPhase =
  | 'idle'
  | 'authenticating'
  | 'needs_pairing'
  | 'code_entry'
  | 'confirming'
  | 'paired'
  | 'auth_error'
  | 'pair_error';

type AuthReply =
  | MessageOf<'auth_ok'>
  | MessageOf<'auth_error'>
  | MessageOf<'pair_ok'>
  | MessageOf<'pair_error'>;

export type PairingSlice = {
  authPhase: AuthPhase;
  pairFailureReason: string | null;
  hasStoredToken: boolean;
  bootstrapped: boolean;
  beginPairing: () => void;
  submitCode: (code: string) => void;
  resetPairing: () => void;
  hydrateAuth: () => Promise<void>;
  onHelloAck: (paired: boolean) => void;
  onAuthMessage: (message: AuthReply) => void;
  onSocketDown: () => void;
};

export const createPairingSlice: StateCreator<RootState, [], [], PairingSlice> = (set, get) => ({
  authPhase: 'idle',
  pairFailureReason: null,
  hasStoredToken: false,
  bootstrapped: false,

  hydrateAuth: async () => {
    const token = await hydrateToken();
    set({ hasStoredToken: token !== null, bootstrapped: true });
  },

  onHelloAck: (paired) => {
    const token = cachedToken();
    if (paired && token !== null) {
      webSocketTransport.send(authMessage(token));
      set({ authPhase: 'authenticating', pairFailureReason: null });
    } else {
      set({ authPhase: 'needs_pairing', pairFailureReason: null });
    }
  },

  beginPairing: () => {
    webSocketTransport.send(pairRequestMessage());
    set({ authPhase: 'code_entry', pairFailureReason: null });
  },

  submitCode: (code) => {
    if (!/^\d{6}$/.test(code)) return;
    webSocketTransport.send(pairConfirmMessage(code));
    set({ authPhase: 'confirming', pairFailureReason: null });
  },

  resetPairing: () => set({ authPhase: 'needs_pairing', pairFailureReason: null }),

  onAuthMessage: (message) => {
    switch (message.type) {
      case 'auth_ok':
        set({ authPhase: 'paired', pairFailureReason: null });
        break;
      case 'pair_ok':
        void writeToken(message.payload.token);
        set({ authPhase: 'paired', hasStoredToken: true, pairFailureReason: null });
        break;
      case 'auth_error':
        void deleteToken();
        get().logError(`auth: ${message.payload.reason}`);
        set({
          authPhase: 'auth_error',
          hasStoredToken: false,
          pairFailureReason: message.payload.reason,
        });
        break;
      case 'pair_error':
        get().logWarn(`pairing: ${message.payload.reason}`);
        set({ authPhase: 'pair_error', pairFailureReason: message.payload.reason });
        break;
    }
  },

  onSocketDown: () => set({ authPhase: 'idle', pairFailureReason: null }),
});
