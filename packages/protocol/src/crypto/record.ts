import { SecureChannelError } from './errors';
import { AEAD_KEY_LEN, aeadOpen, aeadSeal, nonceFromCounter } from './primitives';

const EMPTY_AAD = new Uint8Array(0);
const MAX_COUNTER = 0xffffffffffffffffn;

// Post-handshake transport: one AEAD message per frame, per-direction counter from 0, empty AAD.
// WebSocket-over-TCP is ordered, so counters stay implicit; any open failure or desync throws and
// the caller closes the connection (no recovery, no replay window).
export type RecordLayer = {
  seal(plaintext: Uint8Array): Uint8Array;
  open(ciphertext: Uint8Array): Uint8Array;
};

export function createRecordLayer(sendKey: Uint8Array, recvKey: Uint8Array): RecordLayer {
  if (sendKey.length !== AEAD_KEY_LEN || recvKey.length !== AEAD_KEY_LEN) {
    throw new SecureChannelError('bad_key');
  }
  let sendCounter = 0n;
  let recvCounter = 0n;
  return {
    seal(plaintext) {
      if (sendCounter > MAX_COUNTER) throw new SecureChannelError('nonce_overflow');
      const ciphertext = aeadSeal(sendKey, nonceFromCounter(sendCounter), EMPTY_AAD, plaintext);
      sendCounter += 1n;
      return ciphertext;
    },
    open(ciphertext) {
      if (recvCounter > MAX_COUNTER) throw new SecureChannelError('nonce_overflow');
      // Throws before the counter advances, so a rejected frame never desyncs a good one.
      const plaintext = aeadOpen(recvKey, nonceFromCounter(recvCounter), EMPTY_AAD, ciphertext);
      recvCounter += 1n;
      return plaintext;
    },
  };
}
