import type { Message } from '@slate/protocol';

export type Status = 'connecting' | 'connected' | 'disconnected';

// Pairing mixes the code (base64url of the helper's secret) as the psk; reconnect trusts the pinned
// helper static key instead.
export type SecureStartOptions =
  | { mode: 'pair'; secret: Uint8Array }
  | { mode: 'reconnect'; helperStaticPub: Uint8Array };

export type SecureResult = {
  mode: 'pair' | 'reconnect';
  token?: string;
  helperStaticPub?: Uint8Array;
};

export type TransportHandlers = {
  onStatus: (status: Status) => void;
  onMessage: (message: Message) => void;
  // The encrypted channel is up (pairing issued a token / reconnect authenticated the helper).
  onSecure?: (result: SecureResult) => void;
  onSecureError?: (code: string) => void;
};

// The app builds a semantic Command and hands it here; it never touches platform logic directly.
// A future SshTransport implements the same interface.
export interface Transport {
  setHandlers(handlers: TransportHandlers): void;
  // helperName is the helper's Bonjour service name (when connected via discovery); it lets the
  // transport rediscover the helper at a new IP after a network change.
  connect(host: string, port: number, helperName?: string): void;
  disconnect(): void;
  send(message: Message): void;
  // Begin the handshake over the open socket; results arrive via onSecure / onSecureError.
  startSecure(options: SecureStartOptions): void;
  // Releases the app-lifetime NetInfo subscription; only needed on full teardown / Fast Refresh.
  teardown?(): void;
}
