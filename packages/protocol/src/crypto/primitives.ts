import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { isAllZero, utf8Encode } from './bytes';
import { SecureChannelError } from './errors';

export const AEAD_KEY_LEN = 32;
export const AEAD_TAG_LEN = 16;
export const AEAD_NONCE_LEN = 12;
export const X25519_KEY_LEN = 32;
export const HASH_LEN = 32;

// Byte-for-byte contract labels; both platforms must use these exact strings.
export const PSK_SALT = 'slate/psk/v2';

export type RandomBytes = (length: number) => Uint8Array;

export function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Uint8Array {
  return hkdf(sha256, ikm, salt, info, length);
}

// Nonce = 4 zero bytes || 64-bit little-endian counter (Noise ChaChaPoly convention). Never random,
// never on the wire; the helper mirrors this exactly.
export function nonceFromCounter(counter: bigint): Uint8Array {
  if (counter < 0n || counter > 0xffffffffffffffffn) throw new SecureChannelError('nonce_overflow');
  const nonce = new Uint8Array(AEAD_NONCE_LEN);
  let value = counter;
  for (let i = 4; i < AEAD_NONCE_LEN; i++) {
    nonce[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return nonce;
}

// Returns ciphertext||tag (noble-native framing); the helper builds SealedBox.ciphertext + tag,
// never `.combined`, so the nonce stays off the wire.
export function aeadSeal(
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  plaintext: Uint8Array,
): Uint8Array {
  return chacha20poly1305(key, nonce, aad).encrypt(plaintext);
}

export function aeadOpen(
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  ciphertext: Uint8Array,
): Uint8Array {
  try {
    return chacha20poly1305(key, nonce, aad).decrypt(ciphertext);
  } catch {
    throw new SecureChannelError('aead_open_failed');
  }
}

export function x25519PublicKey(secretKey: Uint8Array): Uint8Array {
  return x25519.getPublicKey(secretKey);
}

export function generateKeyPair(random: RandomBytes): {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
} {
  const secretKey = random(X25519_KEY_LEN);
  return { secretKey, publicKey: x25519.getPublicKey(secretKey) };
}

// noble rejects low-order points; the explicit all-zero re-check keeps the guard visible and mirrors
// the helper (CryptoKit does not reject on its own).
export function dh(secretKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  let shared: Uint8Array;
  try {
    shared = x25519.getSharedSecret(secretKey, publicKey);
  } catch {
    throw new SecureChannelError('bad_public_key');
  }
  if (isAllZero(shared)) throw new SecureChannelError('bad_public_key');
  return shared;
}

export function derivePsk(secret: Uint8Array): Uint8Array {
  return hkdfSha256(secret, utf8Encode(PSK_SALT), new Uint8Array(0), AEAD_KEY_LEN);
}
