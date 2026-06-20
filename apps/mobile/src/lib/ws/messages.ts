import type { Command, MessageOf } from '@slate/protocol';
import { PROTOCOL_VERSION } from '@slate/protocol';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

// Ephemeral for now; a stable id is persisted alongside the auth token when pairing lands.
const deviceId = Crypto.randomUUID();
const deviceName = `slate (${Platform.OS})`;
const appVersion = Constants.expoConfig?.version ?? '0.0.0';

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
