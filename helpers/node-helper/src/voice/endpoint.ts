export type PcmFrame = { data: Int16Array; sampleRate: 48000; channels: 1 };

export interface VoiceEndpoint {
  acceptOffer(sdp: string): Promise<string>;
  addIce(candidate: string | null): Promise<void>;
  onIce(cb: (candidate: string | null) => void): () => void;
  onLocalAudio(cb: (f: PcmFrame) => void): () => void;
  onRemoteAudio(cb: (f: PcmFrame) => void): () => void;
  start(): Promise<void>;
  stop(): Promise<void>;
}
