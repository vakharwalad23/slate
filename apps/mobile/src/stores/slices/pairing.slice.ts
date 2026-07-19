import type { MessageOf } from '@slate/protocol';
import { fromBase64, fromBase64Url, toBase64 } from '@slate/protocol/crypto';
import type { StateCreator } from 'zustand';
import {
  cachedPin,
  cachedToken,
  deleteToken,
  hydratePin,
  hydrateToken,
  writePin,
  writeToken,
} from '@/lib/secure/token-store';
import { authMessage, pairRequestMessage, type SecureResult, webSocketTransport } from '@/lib/ws';
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

type AuthReply = MessageOf<'auth_ok'> | MessageOf<'auth_error'> | MessageOf<'pair_error'>;

export type PairingSlice = {
  authPhase: AuthPhase;
  pairFailureReason: string | null;
  pairExpiresAt: number | null;
  hasStoredToken: boolean;
  bootstrapped: boolean;
  beginPairing: () => void;
  submitCode: (code: string) => void;
  resetPairing: () => void;
  hydrateAuth: () => Promise<void>;
  onHelloAck: (paired: boolean) => void;
  onAuthMessage: (message: AuthReply) => void;
  onSecure: (result: SecureResult) => void;
  onSecureError: (code: string) => void;
  onPairPending: (expiresInMs: number) => void;
  onSocketDown: () => void;
};

export const createPairingSlice: StateCreator<RootState, [], [], PairingSlice> = (set, get) => ({
  authPhase: 'idle',
  pairFailureReason: null,
  pairExpiresAt: null,
  hasStoredToken: false,
  bootstrapped: false,

  hydrateAuth: async () => {
    const [token] = await Promise.all([hydrateToken(), hydratePin()]);
    set({ hasStoredToken: token !== null, bootstrapped: true });
  },

  // Paired devices reconnect over the encrypted channel using the pinned helper key; a fresh device
  // (or one missing the pin) pairs from scratch.
  onHelloAck: (paired) => {
    const token = cachedToken();
    const pin = cachedPin();
    if (paired && token !== null && pin !== null) {
      webSocketTransport.startSecure({ mode: 'reconnect', helperStaticPub: fromBase64(pin) });
      set({ authPhase: 'authenticating', pairFailureReason: null });
    } else {
      set({ authPhase: 'needs_pairing', pairFailureReason: null });
    }
  },

  beginPairing: () => {
    webSocketTransport.send(pairRequestMessage());
    set({ authPhase: 'code_entry', pairFailureReason: null, pairExpiresAt: null });
  },

  // The code is base64url of the helper's pairing secret (scanned or typed). Decode to raw bytes and
  // start the handshake; a wrong code fails to decrypt on the helper and comes back as a pair_error.
  submitCode: (code) => {
    const secret = fromBase64Url(code.trim());
    if (secret.length === 0) return;
    webSocketTransport.startSecure({ mode: 'pair', secret });
    set({ authPhase: 'confirming', pairFailureReason: null });
  },

  resetPairing: () =>
    set({ authPhase: 'needs_pairing', pairFailureReason: null, pairExpiresAt: null }),

  // auth_ok / auth_error arrive inside the encrypted channel on reconnect (next phase).
  onAuthMessage: (message) => {
    switch (message.type) {
      case 'auth_ok':
        set({ authPhase: 'paired', pairFailureReason: null });
        get().subscribeLiveState();
        break;
      case 'auth_error':
        void deleteToken();
        get().logError(`auth: ${message.payload.reason}`);
        set({
          authPhase: 'auth_error',
          hasStoredToken: false,
          pairFailureReason: message.payload.reason,
          pairExpiresAt: null,
        });
        break;
      case 'pair_error':
        get().logWarn(`pairing: ${message.payload.reason}`);
        set({
          authPhase: 'pair_error',
          pairFailureReason: message.payload.reason,
          pairExpiresAt: null,
        });
        break;
    }
  },

  // Pairing: persist the token + pinned helper key and go paired. Reconnect: authenticate the stored
  // token inside the now-encrypted channel and wait for auth_ok.
  onSecure: (result) => {
    if (result.mode === 'reconnect') {
      const token = cachedToken();
      if (token === null) {
        set({ authPhase: 'needs_pairing' });
        return;
      }
      webSocketTransport.send(authMessage(token));
      return;
    }
    if (result.token === undefined || result.helperStaticPub === undefined) return;
    void writeToken(result.token);
    void writePin(toBase64(result.helperStaticPub));
    set({
      authPhase: 'paired',
      hasStoredToken: true,
      pairFailureReason: null,
      pairExpiresAt: null,
    });
    get().subscribeLiveState();
  },

  onSecureError: (code) => {
    if (code === 'bad_handshake') {
      // The helper's identity key no longer matches the pin: keep the token/pin (only a successful
      // re-pair overwrites them) but prompt the user to pair again.
      get().logWarn('helper identity changed - pair again');
      set({
        authPhase: 'auth_error',
        pairFailureReason: 'helper identity changed - pair again',
        pairExpiresAt: null,
      });
      return;
    }
    const reason =
      code === 'bad_code'
        ? 'wrong code'
        : code === 'code_expired'
          ? 'code expired, get a fresh one'
          : code === 'locked'
            ? 'too many attempts, wait and retry'
            : code;
    get().logWarn(`pairing: ${reason}`);
    set({ authPhase: 'pair_error', pairFailureReason: reason, pairExpiresAt: null });
  },

  // The helper auto-regenerates the code on expiry and re-sends this, so the countdown resets in lock-step.
  onPairPending: (expiresInMs) => set({ pairExpiresAt: Date.now() + expiresInMs }),

  onSocketDown: () => set({ authPhase: 'idle', pairFailureReason: null, pairExpiresAt: null }),
});
