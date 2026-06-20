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
  connect: (host: string, port: number) => void;
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
      if (status === 'disconnected') set({ helper: null });
    },
    onMessage: (message) => {
      if (message.type === 'hello_ack') {
        set({
          helper: {
            name: message.payload.helperName,
            version: message.payload.helperVersion,
            capabilities: message.payload.capabilities,
          },
        });
      } else if (message.type === 'command.result') {
        const { ok, error } = message.payload;
        set({ lastResult: { ok, ...(error !== undefined && { error }) } });
      }
    },
  });

  return {
    status: 'disconnected',
    helper: null,
    lastResult: null,
    host: 'localhost',
    port: 8765,
    connect: (host, port) => {
      set({ host, port, lastResult: null });
      webSocketTransport.connect(host, port);
    },
    disconnect: () => {
      webSocketTransport.disconnect();
      set({ helper: null });
    },
    sendCommand: (command) => {
      if (get().helper === null) {
        set({ lastResult: { ok: false, error: 'not connected' } });
        return;
      }
      webSocketTransport.send(commandExecuteMessage(command));
    },
  };
};
