import type { Capabilities, Command } from '@slate/protocol';
import type { StateCreator } from 'zustand';
import type { Status } from '@/lib/ws';
import { commandExecuteMessage, helloMessage, webSocketTransport } from '@/lib/ws';
import type { RootState } from '@/stores/store';

type HelperInfo = { name: string; version: string; capabilities: Capabilities };
type CommandResult = { ok: boolean; error?: string };

export type ConnectionSlice = {
  status: Status;
  helper: HelperInfo | null;
  lastResult: CommandResult | null;
  host: string;
  port: number;
  helperName: string | null;
  connect: (host: string, port: number, helperName?: string) => void;
  disconnect: () => void;
  sendCommand: (command: Command) => void;
};

export const createConnectionSlice: StateCreator<RootState, [], [], ConnectionSlice> = (
  set,
  get,
) => {
  // Registered once at store creation; the transport never imports the store (one-way edge).
  webSocketTransport.setHandlers({
    onStatus: (status) => {
      set({ status });
      if (status === 'connected') webSocketTransport.send(helloMessage());
      if (status === 'disconnected') {
        set({ helper: null });
        get().onSocketDown();
      }
    },
    onMessage: (message) => {
      switch (message.type) {
        case 'hello_ack':
          set({
            helper: {
              name: message.payload.helperName,
              version: message.payload.helperVersion,
              capabilities: message.payload.capabilities,
            },
          });
          get().onHelloAck(message.payload.paired);
          break;
        case 'command.result': {
          const { ok, error } = message.payload;
          set({ lastResult: { ok, ...(error !== undefined && { error }) } });
          if (!ok) get().logError(`command failed: ${error ?? 'unknown'}`);
          break;
        }
        case 'auth_ok':
        case 'auth_error':
        case 'pair_ok':
        case 'pair_error':
          get().onAuthMessage(message);
          break;
        case 'apps.list.response':
          get().ingestAppsResponse(message.payload.apps, message.reId);
          break;
        case 'apps.icon.response':
          for (const icon of message.payload.icons) {
            get().ingestIconResponse(icon.bundleId, icon.pngBase64, icon.iconVersion);
          }
          break;
      }
    },
  });

  return {
    status: 'disconnected',
    helper: null,
    lastResult: null,
    host: 'localhost',
    port: 8765,
    helperName: null,
    connect: (host, port, helperName) => {
      const name = helperName ?? get().helperName ?? undefined;
      set({ host, port, lastResult: null, ...(name !== undefined && { helperName: name }) });
      webSocketTransport.connect(host, port, name);
    },
    disconnect: () => {
      webSocketTransport.disconnect();
      set({ helper: null });
    },
    sendCommand: (command) => {
      // Gate on auth, not on the socket: no command runs before the helper has authed this device.
      if (get().authPhase !== 'paired') {
        set({ lastResult: { ok: false, error: 'not paired' } });
        return;
      }
      webSocketTransport.send(commandExecuteMessage(command));
    },
  };
};
