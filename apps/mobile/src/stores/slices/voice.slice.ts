import type { Message } from '@slate/protocol';
import * as Crypto from 'expo-crypto';
import type { StateCreator } from 'zustand';
import type { CallEvent, CallState, EndReason } from '@/lib/voice/call-state';
import { ACTIVE, initialCallState, voiceReducer } from '@/lib/voice/call-state';
import { VoicePeer } from '@/lib/voice/peer';
import { webSocketTransport } from '@/lib/ws';
import type { RootState } from '@/stores/store';

// If ICE has not reached 'connected' within this window, the call is treated as failed.
const ICE_WATCHDOG_MS = 10000;
// Lets the 'ended' status (and its reason) render briefly before the UI snaps back to idle.
const RESET_DELAY_MS = 1500;

export type VoiceSlice = {
  call: CallState;
  startCall: () => void;
  endCall: (reason: EndReason) => void;
  onVoiceMessage: (message: Message) => void;
};

export const createVoiceSlice: StateCreator<RootState, [], [], VoiceSlice> = (set, get) => {
  // Peer + timers are not serializable and are per-process singletons, so they live outside state
  // (mirrors discovery.slice's BrowseHandle).
  let peer: VoicePeer | null = null;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  const clearWatchdog = () => {
    if (watchdog !== null) {
      clearTimeout(watchdog);
      watchdog = null;
    }
  };
  const clearResetTimer = () => {
    if (resetTimer !== null) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
  };
  const apply = (event: CallEvent) => set({ call: voiceReducer(get().call, event) });

  // Drops the local peer/watchdog and arms the idle reset. Does not itself touch the reducer -
  // callers dispatch the terminal event (user_hangup/socket_drop/ice_failed/remote_hangup) first.
  const teardownLocal = () => {
    clearWatchdog();
    peer = null;
    clearResetTimer();
    resetTimer = setTimeout(() => {
      resetTimer = null;
      apply({ type: 'reset' });
    }, RESET_DELAY_MS);
  };

  return {
    call: initialCallState,

    startCall: () => {
      if (get().call.status !== 'idle') return;
      const callId = Crypto.randomUUID();
      const p = new VoicePeer(Crypto.randomUUID);
      peer = p;
      p.onOutbound = (message) => webSocketTransport.send(message);
      p.onIceState = (state) => {
        if (peer !== p) return; // callback from a peer already superseded/torn down
        if (state === 'connected') {
          clearWatchdog();
          apply({ type: 'ice_connected' });
        } else if (state === 'failed' || state === 'closed') {
          get().endCall('ice_failed');
        }
      };

      apply({ type: 'user_start', callId });
      watchdog = setTimeout(() => {
        watchdog = null;
        if (get().call.status !== 'in_call') get().endCall('ice_failed');
      }, ICE_WATCHDOG_MS);

      void p.start(callId).catch(() => {
        // getUserMedia rejected (mic permission denied, no device, etc.) - the call can't proceed.
        if (peer === p) get().endCall('ice_failed');
      });
    },

    endCall: (reason) => {
      // Guard on ACTIVE (not just !== 'idle'): a second teardown event racing in right after
      // the first (e.g. ice_failed then socket_drop from the same network drop) would otherwise
      // re-arm resetTimer and needlessly delay the return to idle.
      if (!ACTIVE.includes(get().call.status)) return;
      peer?.hangup();
      teardownLocal();
      apply({ type: reason });
    },

    onVoiceMessage: (message) => {
      if (peer === null) return;
      peer.onSignal(message);
      switch (message.type) {
        case 'voice.answer':
          apply({ type: 'answered', callId: message.payload.callId });
          break;
        case 'voice.hangup':
          // Remote already tore itself down inside peer.onSignal (no echo); just teardown locally.
          teardownLocal();
          apply({ type: 'remote_hangup', callId: message.payload.callId });
          break;
        default:
          break;
      }
    },
  };
};
