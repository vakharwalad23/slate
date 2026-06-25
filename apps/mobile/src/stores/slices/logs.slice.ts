import * as Crypto from 'expo-crypto';
import type { StateCreator } from 'zustand';
import type { RootState } from '@/stores/store';

type LogLevel = 'warn' | 'error';
export type LogEntry = { id: string; level: LogLevel; message: string; at: number };

export type LogsSlice = {
  logs: LogEntry[];
  logWarn: (message: string) => void;
  logError: (message: string) => void;
  clearLogs: () => void;
};

const LIMIT = 200;

export const createLogsSlice: StateCreator<RootState, [], [], LogsSlice> = (set) => {
  const append = (level: LogLevel, message: string) =>
    set((state) => {
      const entry: LogEntry = { id: Crypto.randomUUID(), level, message, at: Date.now() };
      const logs = [...state.logs, entry];
      return { logs: logs.length > LIMIT ? logs.slice(logs.length - LIMIT) : logs };
    });

  return {
    logs: [],
    logWarn: (message) => append('warn', message),
    logError: (message) => append('error', message),
    clearLogs: () => set({ logs: [] }),
  };
};
