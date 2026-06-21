import type { Message } from '@slate/protocol';

export type Status = 'connecting' | 'connected' | 'disconnected';

export type TransportHandlers = {
  onStatus: (status: Status) => void;
  onMessage: (message: Message) => void;
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
}
