import { z } from 'zod';
import { CapabilitiesSchema } from './capabilities';
import { CommandSchema } from './command';
import { envelopeBase } from './envelope';
import {
  VoiceAnswerPayload,
  VoiceHangupPayload,
  VoiceIcePayload,
  VoiceOfferPayload,
} from './voice';

export const AppInfoSchema = z.object({
  bundleId: z.string(),
  name: z.string(),
  path: z.string(),
  iconVersion: z.string(),
});
export type AppInfo = z.infer<typeof AppInfoSchema>;

function msg<T extends string, P extends z.ZodType>(type: T, payload: P) {
  return z.object({ ...envelopeBase, type: z.literal(type), payload });
}

export const HelloMessage = msg(
  'hello',
  z.object({ deviceId: z.string(), deviceName: z.string(), appVersion: z.string() }),
);
export const PairRequestMessage = msg('pair_request', z.object({}));
export const AuthMessage = msg('auth', z.object({ token: z.string() }));
export const CommandExecuteMessage = msg('command.execute', CommandSchema);
export const AppsListMessage = msg('apps.list', z.object({}));
export const AppsIconMessage = msg('apps.icon', z.object({ bundleIds: z.array(z.string()) }));
export const SubscribeStateMessage = msg(
  'subscribe.state',
  z.object({ topics: z.array(z.string()) }),
);
export const PingMessage = msg('ping', z.object({ t: z.number() }));

// Secure channel (v2). Byte fields are base64; the crypto contract lives outside Zod in
// fixtures/crypto-vectors.json. Nonces are never on the wire (implicit per-direction counters).
export const SecHelloMessage = msg(
  'sec_hello',
  z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('pair'), e: z.base64() }),
    z.object({ mode: z.literal('reconnect'), e: z.base64(), d: z.base64() }),
  ]),
);
export const SecConfirmMessage = msg('sec_confirm', z.object({ d: z.base64() }));

export const HelloAckMessage = msg(
  'hello_ack',
  z.object({
    helperName: z.string(),
    helperVersion: z.string(),
    capabilities: CapabilitiesSchema,
    paired: z.boolean(),
  }),
);
export const PairErrorMessage = msg('pair_error', z.object({ reason: z.string() }));
// Time left on the displayed code so the app countdown matches the helper; never carries the code itself.
export const PairPendingMessage = msg('pair_pending', z.object({ expiresInMs: z.number() }));
export const AuthOkMessage = msg('auth_ok', z.object({}));
export const AuthErrorMessage = msg('auth_error', z.object({ reason: z.string() }));
export const CommandResultMessage = msg(
  'command.result',
  z.object({ ok: z.boolean(), error: z.string().optional(), data: z.unknown().optional() }),
);
export const AppsListResponseMessage = msg(
  'apps.list.response',
  z.object({ apps: z.array(AppInfoSchema) }),
);
export const AppsIconResponseMessage = msg(
  'apps.icon.response',
  z.object({
    icons: z.array(
      z.object({ bundleId: z.string(), pngBase64: z.string(), iconVersion: z.string() }),
    ),
  }),
);
export const StateUpdateMessage = msg(
  'state.update',
  z.object({ topic: z.string(), value: z.unknown() }),
);
export const PongMessage = msg('pong', z.object({ t: z.number() }));
export const ErrorMessage = msg('error', z.object({ code: z.string(), message: z.string() }));
export const SecHelloAckMessage = msg(
  'sec_hello_ack',
  z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('pair'), e: z.base64(), s: z.base64() }),
    z.object({ mode: z.literal('reconnect'), e: z.base64(), d: z.base64() }),
  ]),
);
export const SecConfirmAckMessage = msg('sec_confirm_ack', z.object({ d: z.base64() }));
export const SecErrorMessage = msg(
  'sec_error',
  z.object({ code: z.string(), message: z.string() }),
);
// Both directions: record-layer ciphertext of a full inner v2 envelope JSON.
export const EncMessage = msg('enc', z.object({ c: z.base64() }));

export const VoiceOfferMessage = msg('voice.offer', VoiceOfferPayload);
export const VoiceAnswerMessage = msg('voice.answer', VoiceAnswerPayload);
export const VoiceIceMessage = msg('voice.ice', VoiceIcePayload);
export const VoiceHangupMessage = msg('voice.hangup', VoiceHangupPayload);

export const MessageSchema = z.discriminatedUnion('type', [
  HelloMessage,
  PairRequestMessage,
  AuthMessage,
  CommandExecuteMessage,
  AppsListMessage,
  AppsIconMessage,
  SubscribeStateMessage,
  PingMessage,
  SecHelloMessage,
  SecConfirmMessage,
  HelloAckMessage,
  PairErrorMessage,
  PairPendingMessage,
  AuthOkMessage,
  AuthErrorMessage,
  CommandResultMessage,
  AppsListResponseMessage,
  AppsIconResponseMessage,
  StateUpdateMessage,
  PongMessage,
  ErrorMessage,
  SecHelloAckMessage,
  SecConfirmAckMessage,
  SecErrorMessage,
  EncMessage,
  VoiceOfferMessage,
  VoiceAnswerMessage,
  VoiceIceMessage,
  VoiceHangupMessage,
]);

export type Message = z.infer<typeof MessageSchema>;

// Narrow the union by its `type` tag so outbound literals stay fully typed without a cast.
export type MessageOf<T extends Message['type']> = Extract<Message, { type: T }>;
