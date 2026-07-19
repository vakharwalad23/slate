import type { Message } from '@slate/protocol';
import { MessageSchema } from '@slate/protocol';
import {
  createPairInitiator,
  createReconnectInitiator,
  createRecordLayer,
  fromBase64,
  generateKeyPair,
  type RecordLayer,
  toBase64,
  utf8Decode,
  utf8Encode,
} from '@slate/protocol/crypto';
import { randomBytes } from '@/lib/secure/crypto/rng';
import {
  encMessage,
  secConfirmMessage,
  secHelloPairMessage,
  secHelloReconnectMessage,
} from './messages';
import type { SecureResult } from './transport';

// What the transport should do with a processed sec_*/enc frame.
export type SecureOutcome =
  | { type: 'send'; message: Message }
  | { type: 'secured'; result: SecureResult }
  | { type: 'error'; code: string }
  | { type: 'deliver'; message: Message }
  | { type: 'fatal' }
  | { type: 'ignore' };

export type SecureChannel = {
  readonly secure: boolean;
  initialFrame(): Message;
  onFrame(message: Message): SecureOutcome;
  wrapOutbound(message: Message): Message | null;
};

// Post-handshake record ops, shared by both channel kinds.
function openEnc(records: RecordLayer, c: string): SecureOutcome {
  const inner: unknown = JSON.parse(utf8Decode(records.open(fromBase64(c))));
  const parsed = MessageSchema.safeParse(inner);
  return parsed.success ? { type: 'deliver', message: parsed.data } : { type: 'fatal' };
}

function sealEnc(records: RecordLayer, message: Message): Message | null {
  try {
    return encMessage(toBase64(records.seal(utf8Encode(JSON.stringify(message)))));
  } catch {
    return null;
  }
}

// Phone-side pair handshake driver. Ephemerals come from the device CSPRNG; the pairing code (raw
// secret bytes) is mixed as the psk. Any crypto failure returns 'fatal' so the transport drops the
// socket rather than continue on a broken channel.
export function createPairChannel(secret: Uint8Array): SecureChannel {
  const initiator = createPairInitiator(generateKeyPair(randomBytes));
  let records: RecordLayer | null = null;
  return {
    get secure() {
      return records !== null;
    },
    initialFrame() {
      return secHelloPairMessage(toBase64(initiator.hello()));
    },
    onFrame(message) {
      try {
        switch (message.type) {
          case 'sec_hello_ack': {
            const payload = message.payload;
            if (payload.mode !== 'pair') return { type: 'fatal' };
            const confirm = initiator.consumeAck(
              fromBase64(payload.e),
              fromBase64(payload.s),
              secret,
            );
            return { type: 'send', message: secConfirmMessage(toBase64(confirm)) };
          }
          case 'sec_confirm_ack': {
            const result = initiator.finish(fromBase64(message.payload.d));
            records = createRecordLayer(result.sendKey, result.recvKey);
            return {
              type: 'secured',
              result: {
                mode: 'pair',
                token: result.token,
                helperStaticPub: result.helperStaticPub,
              },
            };
          }
          case 'sec_error':
            return { type: 'error', code: message.payload.code };
          case 'enc':
            return records === null ? { type: 'ignore' } : openEnc(records, message.payload.c);
          default:
            return { type: 'ignore' };
        }
      } catch {
        return { type: 'fatal' };
      }
    },
    wrapOutbound(message) {
      return records === null ? null : sealEnc(records, message);
    },
  };
}

// Phone-side codeless reconnect driver. Encrypts to the pinned helper static key; the caller sends the
// bearer token inside the channel once secured.
export function createReconnectChannel(helperStaticPub: Uint8Array): SecureChannel {
  const initiator = createReconnectInitiator(generateKeyPair(randomBytes), helperStaticPub);
  let records: RecordLayer | null = null;
  return {
    get secure() {
      return records !== null;
    },
    initialFrame() {
      const hello = initiator.hello();
      return secHelloReconnectMessage(toBase64(hello.e), toBase64(hello.d));
    },
    onFrame(message) {
      try {
        switch (message.type) {
          case 'sec_hello_ack': {
            const payload = message.payload;
            if (payload.mode !== 'reconnect') return { type: 'fatal' };
            const keys = initiator.finish(fromBase64(payload.e), fromBase64(payload.d));
            records = createRecordLayer(keys.sendKey, keys.recvKey);
            return { type: 'secured', result: { mode: 'reconnect' } };
          }
          case 'sec_error':
            return { type: 'error', code: message.payload.code };
          case 'enc':
            return records === null ? { type: 'ignore' } : openEnc(records, message.payload.c);
          default:
            return { type: 'ignore' };
        }
      } catch {
        return { type: 'fatal' };
      }
    },
    wrapOutbound(message) {
      return records === null ? null : sealEnc(records, message);
    },
  };
}
