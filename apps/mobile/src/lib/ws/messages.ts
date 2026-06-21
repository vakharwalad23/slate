import type { Command, MessageOf } from '@slate/protocol';
import { PROTOCOL_VERSION } from '@slate/protocol';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

// Fallback id until the stable one is hydrated from secure-store at startup; setDeviceId overwrites it
// before any connect (the bootstrap gate ensures hello is never sent with the throwaway id).
let deviceId = Crypto.randomUUID();
const deviceName = `slate (${Platform.OS})`;
const appVersion = Constants.expoConfig?.version ?? '0.0.0';

export function setDeviceId(id: string): void {
  deviceId = id;
}

export function helloMessage(): MessageOf<'hello'> {
  return {
    v: PROTOCOL_VERSION,
    id: Crypto.randomUUID(),
    reId: null,
    type: 'hello',
    payload: { deviceId, deviceName, appVersion },
  };
}

export function pingMessage(t: number): MessageOf<'ping'> {
  return { v: PROTOCOL_VERSION, id: Crypto.randomUUID(), reId: null, type: 'ping', payload: { t } };
}

export function commandExecuteMessage(command: Command): MessageOf<'command.execute'> {
  return {
    v: PROTOCOL_VERSION,
    id: Crypto.randomUUID(),
    reId: null,
    type: 'command.execute',
    payload: command,
  };
}

export function pairRequestMessage(): MessageOf<'pair_request'> {
  return {
    v: PROTOCOL_VERSION,
    id: Crypto.randomUUID(),
    reId: null,
    type: 'pair_request',
    payload: {},
  };
}

export function pairConfirmMessage(code: string): MessageOf<'pair_confirm'> {
  return {
    v: PROTOCOL_VERSION,
    id: Crypto.randomUUID(),
    reId: null,
    type: 'pair_confirm',
    payload: { code },
  };
}

export function authMessage(token: string): MessageOf<'auth'> {
  return {
    v: PROTOCOL_VERSION,
    id: Crypto.randomUUID(),
    reId: null,
    type: 'auth',
    payload: { token },
  };
}
