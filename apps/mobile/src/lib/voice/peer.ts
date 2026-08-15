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
// 7): on a glare it rolls back its own offer instead of asserting it over the remote's.
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

  async start(): Promise<void> {
    if (this.pc !== null) return;
    this.callId = this.newId();
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
    try {
      this.makingOffer = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.onOutbound?.(voiceOfferMessage(callId, offer.sdp, this.newId));
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
    // Polite guard: an answer that arrives outside have-local-offer does not match our pending
    // offer (stale frame or glare); roll back rather than apply it.
    if (pc.signalingState !== 'have-local-offer') {
      await pc.setLocalDescription(new RTCSessionDescription({ type: 'rollback', sdp: '' }));
      return;
    }
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
  }

  private async handleRemoteIce(candidate: string | null): Promise<void> {
    const pc = this.pc;
    if (pc === null || candidate === null) return;
    // The wire payload carries only the candidate string; the protocol is single-m-line
    // audio-only, so sdpMLineIndex is always 0.
    await pc.addIceCandidate(new RTCIceCandidate({ candidate, sdpMLineIndex: 0, sdpMid: null }));
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
