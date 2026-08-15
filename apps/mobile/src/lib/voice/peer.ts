import type { Message } from '@slate/protocol';
import {
  type MediaStream,
  mediaDevices,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import { voiceHangupMessage, voiceIceMessage, voiceOfferMessage } from './messages';

type NewId = () => string;

export type IceState = 'connected' | 'failed' | 'checking' | 'closed';

// Phone is the polite peer (perfect negotiation, out-of-band fixed roles; see design doc section
// 7): it never asserts a stale/out-of-order answer over its own pending offer, it just drops it.
export class VoicePeer {
  private readonly newId: NewId;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private callId: string | null = null;
  private makingOffer = false;

  onOutbound: ((message: Message) => void) | null = null;
  onIceState: ((state: IceState) => void) | null = null;

  constructor(newId: NewId) {
    this.newId = newId;
  }

  // callId is minted by the caller (the voice slice), not here: the reducer's user_start and this
  // peer's wire callId must be the same value, so the single mint has to happen above both.
  async start(callId: string): Promise<void> {
    if (this.pc !== null) return;
    this.callId = callId;
    const pc = new RTCPeerConnection({ iceServers: [] });
    this.pc = pc;

    pc.onnegotiationneeded = () => {
      void this.handleNegotiationNeeded();
    };
    pc.onicecandidate = (event: { candidate: RTCIceCandidate | null }) => {
      const callId = this.callId;
      if (callId === null) return;
      this.onOutbound?.(voiceIceMessage(callId, event.candidate?.candidate ?? null, this.newId));
    };
    pc.oniceconnectionstatechange = () => {
      this.handleIceStateChange();
    };

    // react-native-webrtc owns the AVAudioSession category/mode for the call's lifetime; setting
    // it manually here would fight the library's own audio-route management.
    const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
    // hangup() can race a slow getUserMedia prompt; do not wire a mic stream into a peer
    // connection that is already torn down.
    if (this.pc !== pc) {
      for (const track of stream.getAudioTracks()) track.stop();
      return;
    }
    this.localStream = stream;
    for (const track of stream.getAudioTracks()) {
      pc.addTrack(track, stream);
    }
  }

  private async handleNegotiationNeeded(): Promise<void> {
    const pc = this.pc;
    const callId = this.callId;
    if (pc === null || callId === null || this.makingOffer) return;
    this.makingOffer = true;
    try {
      const offer = await pc.createOffer();
      // teardown() (from hangup() or a fresh start()) can race either await below; re-check
      // identity so a stale offer never fires onOutbound with a dead pc or a superseded callId.
      if (this.pc !== pc || this.callId !== callId) return;
      await pc.setLocalDescription(offer);
      if (this.pc !== pc || this.callId !== callId) return;
      this.onOutbound?.(voiceOfferMessage(callId, offer.sdp, this.newId));
    } catch {
      // A closed pc mid-flight throws here; the call's fate is already decided elsewhere
      // (onIceState / hangup), so there is nothing more to do.
    } finally {
      this.makingOffer = false;
    }
  }

  onSignal(message: Message): void {
    if (this.pc === null || this.callId === null) return;
    switch (message.type) {
      case 'voice.answer':
        if (message.payload.callId !== this.callId) return;
        void this.handleAnswer(message.payload.sdp);
        return;
      case 'voice.ice':
        if (message.payload.callId !== this.callId) return;
        void this.handleRemoteIce(message.payload.candidate);
        return;
      case 'voice.hangup':
        if (message.payload.callId !== this.callId) return;
        this.teardown();
        return;
      default:
        return;
    }
  }

  private async handleAnswer(sdp: string): Promise<void> {
    const pc = this.pc;
    if (pc === null) return;
    // rollback is only valid to call from have-local-offer; outside that state this answer is
    // stale/out-of-order (there is no pending local offer for it to satisfy) - ignore it rather
    // than call rollback, which would throw InvalidStateError from any other signaling state.
    if (pc.signalingState !== 'have-local-offer') return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
    } catch {
      // Torn down mid-flight (races with teardown()); nothing more to do here.
    }
  }

  private async handleRemoteIce(candidate: string | null): Promise<void> {
    const pc = this.pc;
    if (pc === null || candidate === null) return;
    try {
      // The wire payload carries only the candidate string; the protocol is single-m-line
      // audio-only, so sdpMLineIndex is always 0.
      await pc.addIceCandidate(new RTCIceCandidate({ candidate, sdpMLineIndex: 0, sdpMid: null }));
    } catch {
      // Torn down mid-flight (races with teardown()); nothing more to do here.
    }
  }

  private handleIceStateChange(): void {
    const pc = this.pc;
    if (pc === null) return;
    const state = pc.iceConnectionState;
    // Only the states the call state machine understands are forwarded; 'new' / 'completed' /
    // 'disconnected' are transient and left to the watchdog / socket-drop paths.
    if (state === 'connected' || state === 'failed' || state === 'checking' || state === 'closed') {
      this.onIceState?.(state);
    }
  }

  // User-initiated hangup: echoes voice.hangup to the remote, then tears down. A remote-initiated
  // hangup goes through onSignal -> teardown() directly so it never echoes back.
  hangup(): void {
    if (this.pc !== null && this.callId !== null) {
      this.onOutbound?.(voiceHangupMessage(this.callId, 'user_hangup', this.newId));
    }
    this.teardown();
  }

  private teardown(): void {
    const pc = this.pc;
    if (pc !== null) {
      pc.onnegotiationneeded = null;
      pc.onicecandidate = null;
      pc.oniceconnectionstatechange = null;
      for (const sender of pc.getSenders()) sender.track?.stop();
      for (const receiver of pc.getReceivers()) receiver.track?.stop();
      pc.close();
    }
    for (const track of this.localStream?.getTracks() ?? []) track.stop();
    this.pc = null;
    this.localStream = null;
    this.callId = null;
    this.makingOffer = false;
    this.onOutbound = null;
    this.onIceState = null;
  }
}
