import { randomInt } from 'node:crypto';
import { OpusEncoder } from '@discordjs/opus';
import { AudioIO, type IoStreamRead, type IoStreamWrite, SampleFormat16Bit } from 'naudiodon2';
import { MediaStreamTrack, RTCPeerConnection, RtpHeader, RtpPacket } from 'werift';
import type { PcmFrame, VoiceEndpoint } from './endpoint';

// 20 ms at 48 kHz mono - the frame size @discordjs/opus and every RTP timestamp step assume.
const FRAME_SAMPLES = 960;
const FRAME_MS = 20;
const FRAME_BYTES = FRAME_SAMPLES * 2;
const JITTER_MIN_FRAMES = 2;
const JITTER_MAX_FRAMES = 4;
const SEQ_MODULO = 0x10000;
const TIMESTAMP_MODULO = 0x100000000;
// Dynamic-PT placeholder for pre-negotiation packets; MediaStreamTrack.writeRtp overwrites it
// from the negotiated codec's payloadType once the answer is applied.
const PLACEHOLDER_PAYLOAD_TYPE = 111;

function bufferToInt16(buf: Buffer, sampleCount: number): Int16Array {
  const out = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    out[i] = buf.readInt16LE(i * 2);
  }
  return out;
}

function quitStream(stream: IoStreamRead | IoStreamWrite): Promise<void> {
  return new Promise((resolve) => {
    stream.quit(() => resolve());
  });
}

// Throwaway Node audio path (werift + @discordjs/opus + naudiodon2); the Swift helper replaces
// this whole file with libwebrtc + AVAudioEngine (which also brings AEC). Everything
// library-specific stays behind VoiceEndpoint so nothing else in the helper knows it exists.
export class WeriftVoiceEndpoint implements VoiceEndpoint {
  private pc: RTCPeerConnection | null = null;
  private localTrack: MediaStreamTrack | null = null;
  private remoteTrack: MediaStreamTrack | null = null;
  private encoder: OpusEncoder | null = null;
  private decoder: OpusEncoder | null = null;
  private micStream: IoStreamRead | null = null;
  private speakerStream: IoStreamWrite | null = null;
  private unsubReceiveRtp: (() => void) | null = null;
  private jitterTimer: NodeJS.Timeout | null = null;
  private jitterQueue: Buffer[] = [];
  private micAcc: Buffer = Buffer.alloc(0);
  private seq = 0;
  private ts = 0;
  private ssrc = 0;
  private started = false;
  private stopped = false;
  private iceCb: ((candidate: string | null) => void) | null = null;
  private localAudioCb: ((f: PcmFrame) => void) | null = null;
  private remoteAudioCb: ((f: PcmFrame) => void) | null = null;

  async start(): Promise<void> {
    if (this.started) return;
    // Only latch `started` once every resource actually opened; a device/permission
    // failure mid-setup must leave the instance retryable, not wedged open forever.
    try {
      this.encoder = new OpusEncoder(48000, 1);
      this.decoder = new OpusEncoder(48000, 1);

      this.micStream = AudioIO({
        inOptions: { channelCount: 1, sampleFormat: SampleFormat16Bit, sampleRate: 48000 },
      });
      this.speakerStream = AudioIO({
        outOptions: { channelCount: 1, sampleFormat: SampleFormat16Bit, sampleRate: 48000 },
      });

      this.pc = new RTCPeerConnection({ iceServers: [] });
      this.pc.onicecandidate = (event) => {
        this.iceCb?.(event.candidate ? event.candidate.candidate : null);
      };

      this.localTrack = new MediaStreamTrack({ kind: 'audio' });
      const transceiver = this.pc.addTransceiver(this.localTrack, { direction: 'sendrecv' });
      this.remoteTrack = transceiver.receiver.track;
      const { unSubscribe } = this.remoteTrack.onReceiveRtp.subscribe((packet) => {
        this.handleRemoteRtp(packet);
      });
      this.unsubReceiveRtp = unSubscribe;

      this.ssrc = randomInt(1, 0xffffffff);
      this.seq = randomInt(0, SEQ_MODULO);
      this.ts = randomInt(0, TIMESTAMP_MODULO);

      this.micStream.on('data', (chunk: Buffer) => this.handleMicChunk(chunk));
      this.micStream.start();
      this.speakerStream.start();
      this.jitterTimer = setInterval(() => this.drainJitterBuffer(), FRAME_MS);
    } catch (err) {
      this.started = false;
      throw err;
    }
    this.started = true;
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;

    if (this.jitterTimer) {
      clearInterval(this.jitterTimer);
      this.jitterTimer = null;
    }
    this.jitterQueue = [];

    this.unsubReceiveRtp?.();
    this.unsubReceiveRtp = null;

    if (this.pc) {
      this.pc.onicecandidate = null;
      await this.pc.close();
      this.pc = null;
    }

    if (this.micStream) {
      await quitStream(this.micStream);
      this.micStream = null;
    }
    if (this.speakerStream) {
      await quitStream(this.speakerStream);
      this.speakerStream = null;
    }

    this.encoder = null;
    this.decoder = null;
    this.localTrack = null;
    this.remoteTrack = null;
    this.micAcc = Buffer.alloc(0);

    this.iceCb = null;
    this.localAudioCb = null;
    this.remoteAudioCb = null;
  }

  async acceptOffer(sdp: string): Promise<string> {
    if (!this.pc) throw new Error('endpoint not started');
    await this.pc.setRemoteDescription({ type: 'offer', sdp });
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer.sdp;
  }

  async addIce(candidate: string | null): Promise<void> {
    if (!this.pc || candidate === null) return;
    await this.pc.addIceCandidate({ candidate });
  }

  onIce(cb: (candidate: string | null) => void): () => void {
    this.iceCb = cb;
    return () => {
      if (this.iceCb === cb) this.iceCb = null;
    };
  }

  onLocalAudio(cb: (f: PcmFrame) => void): () => void {
    this.localAudioCb = cb;
    return () => {
      if (this.localAudioCb === cb) this.localAudioCb = null;
    };
  }

  onRemoteAudio(cb: (f: PcmFrame) => void): () => void {
    this.remoteAudioCb = cb;
    return () => {
      if (this.remoteAudioCb === cb) this.remoteAudioCb = null;
    };
  }

  private handleMicChunk(chunk: Buffer): void {
    this.micAcc = this.micAcc.length === 0 ? chunk : Buffer.concat([this.micAcc, chunk]);
    while (this.micAcc.length >= FRAME_BYTES) {
      const frame = this.micAcc.subarray(0, FRAME_BYTES);
      this.micAcc = this.micAcc.subarray(FRAME_BYTES);
      this.sendFrame(frame);
    }
  }

  private sendFrame(frame: Buffer): void {
    this.localAudioCb?.({
      data: bufferToInt16(frame, FRAME_SAMPLES),
      sampleRate: 48000,
      channels: 1,
    });
    if (!this.encoder || !this.localTrack) return;

    const opusPayload = this.encoder.encode(frame);
    const header = new RtpHeader({
      payloadType: PLACEHOLDER_PAYLOAD_TYPE,
      sequenceNumber: this.seq,
      timestamp: this.ts,
      ssrc: this.ssrc,
      marker: false,
    });
    this.seq = (this.seq + 1) % SEQ_MODULO;
    this.ts = (this.ts + FRAME_SAMPLES) % TIMESTAMP_MODULO;
    this.localTrack.writeRtp(new RtpPacket(header, opusPayload));
  }

  private handleRemoteRtp(packet: RtpPacket): void {
    if (!this.decoder) return;
    const pcm = this.decoder.decode(packet.payload);
    // DTX/comfort-noise (or any non-20ms) packets decode to a different length; the fixed
    // FRAME_SAMPLES readInt16LE loop would read past the buffer, so drop anything that
    // doesn't match rather than crash the jitter-drain timer mid-call.
    if (pcm.length !== FRAME_BYTES) {
      console.warn('dropped remote opus frame with unexpected decoded length', pcm.length);
      return;
    }
    this.jitterQueue.push(pcm);
    if (this.jitterQueue.length > JITTER_MAX_FRAMES) this.jitterQueue.shift();
  }

  private drainJitterBuffer(): void {
    if (this.jitterQueue.length < JITTER_MIN_FRAMES) return;
    const frame = this.jitterQueue.shift();
    if (!frame) return;
    this.remoteAudioCb?.({
      data: bufferToInt16(frame, FRAME_SAMPLES),
      sampleRate: 48000,
      channels: 1,
    });
    this.speakerStream?.write(frame);
  }
}

export function createWeriftEndpoint(): VoiceEndpoint {
  return new WeriftVoiceEndpoint();
}
