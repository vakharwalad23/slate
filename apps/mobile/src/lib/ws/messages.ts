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

export function secHelloPairMessage(e: string): MessageOf<'sec_hello'> {
  return {
    v: PROTOCOL_VERSION,
    id: Crypto.randomUUID(),
    reId: null,
    type: 'sec_hello',
    payload: { mode: 'pair', e },
  };
}

export function secConfirmMessage(d: string): MessageOf<'sec_confirm'> {
  return {
    v: PROTOCOL_VERSION,
    id: Crypto.randomUUID(),
    reId: null,
    type: 'sec_confirm',
    payload: { d },
  };
}

export function encMessage(c: string): MessageOf<'enc'> {
  return { v: PROTOCOL_VERSION, id: Crypto.randomUUID(), reId: null, type: 'enc', payload: { c } };
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

export function appsListMessage(): MessageOf<'apps.list'> {
  return {
    v: PROTOCOL_VERSION,
    id: Crypto.randomUUID(),
    reId: null,
    type: 'apps.list',
    payload: {},
  };
}

export function appsIconMessage(bundleIds: string[]): MessageOf<'apps.icon'> {
  return {
    v: PROTOCOL_VERSION,
    id: Crypto.randomUUID(),
    reId: null,
    type: 'apps.icon',
    payload: { bundleIds },
  };
}

export function subscribeStateMessage(topics: string[]): MessageOf<'subscribe.state'> {
  return {
    v: PROTOCOL_VERSION,
    id: Crypto.randomUUID(),
    reId: null,
    type: 'subscribe.state',
    payload: { topics },
  };
}
