import { sha256 } from '@noble/hashes/sha2.js';
import { concat, utf8Decode, utf8Encode } from './bytes';
import { SecureChannelError } from './errors';
import { aeadOpen, aeadSeal, derivePsk, dh, hkdfSha256, nonceFromCounter } from './primitives';

// Hand-rolled fixed Noise-style handshake (pair = NX+psk shaped, reconnect = NK shaped). The exact
// transcript is the interop contract, pinned by fixtures/crypto-vectors.json against CryptoKit.
const PROTOCOL_LABEL = 'slate/sec/v2/x25519-hkdf-sha256-chacha20poly1305';
const KDF_INFO_MIX = 'slate/v2/mix';
const KDF_INFO_SPLIT = 'slate/v2/split';

export type KeyPair = { secretKey: Uint8Array; publicKey: Uint8Array };
export type RecordKeys = { sendKey: Uint8Array; recvKey: Uint8Array };
export type PairResult = { token: string; helperStaticPub: Uint8Array } & RecordKeys;

type SymmetricState = { h: Uint8Array; ck: Uint8Array; k: Uint8Array | null; n: bigint };

function initSymmetric(): SymmetricState {
  const h = sha256(utf8Encode(PROTOCOL_LABEL));
  return { h, ck: h, k: null, n: 0n };
}

function mixHash(ss: SymmetricState, data: Uint8Array): void {
  ss.h = sha256(concat(ss.h, data));
}

function mixKey(ss: SymmetricState, ikm: Uint8Array): void {
  const okm = hkdfSha256(ikm, ss.ck, utf8Encode(KDF_INFO_MIX), 64);
  ss.ck = okm.slice(0, 32);
  ss.k = okm.slice(32, 64);
  ss.n = 0n;
}

function encryptAndHash(ss: SymmetricState, plaintext: Uint8Array): Uint8Array {
  if (ss.k === null) throw new SecureChannelError('bad_handshake');
  const ct = aeadSeal(ss.k, nonceFromCounter(ss.n), ss.h, plaintext);
  ss.n += 1n;
  mixHash(ss, ct);
  return ct;
}

function decryptAndHash(ss: SymmetricState, ciphertext: Uint8Array): Uint8Array {
  if (ss.k === null) throw new SecureChannelError('bad_handshake');
  // Throws before any state mutation, so a failed open leaves the transcript untouched.
  const pt = aeadOpen(ss.k, nonceFromCounter(ss.n), ss.h, ciphertext);
  ss.n += 1n;
  mixHash(ss, ciphertext);
  return pt;
}

// Directional transport keys, bound to the full transcript via ck.
function split(ss: SymmetricState): { c2s: Uint8Array; s2c: Uint8Array } {
  const okm = hkdfSha256(new Uint8Array(0), ss.ck, utf8Encode(KDF_INFO_SPLIT), 64);
  return { c2s: okm.slice(0, 32), s2c: okm.slice(32, 64) };
}

function encodeToken(token: string): Uint8Array {
  return utf8Encode(JSON.stringify({ token }));
}

function decodeToken(bytes: Uint8Array): string {
  const parsed = JSON.parse(utf8Decode(bytes)) as { token?: unknown };
  if (typeof parsed.token !== 'string') throw new SecureChannelError('bad_handshake');
  return parsed.token;
}

// Phone side of pairing. `secret` is the pairing-code bytes (format-agnostic; mixed as the psk).
export type PairInitiator = {
  hello(): Uint8Array;
  consumeAck(ackE: Uint8Array, ackS: Uint8Array, secret: Uint8Array): Uint8Array;
  finish(confirmAckD: Uint8Array): PairResult;
};

export function createPairInitiator(ephemeral: KeyPair): PairInitiator {
  const ss = initSymmetric();
  mixHash(ss, utf8Encode('pair'));
  mixHash(ss, ephemeral.publicKey);
  let helperStaticPub: Uint8Array | null = null;
  return {
    hello: () => ephemeral.publicKey,
    consumeAck(ackE, ackS, secret) {
      mixHash(ss, ackE);
      mixKey(ss, dh(ephemeral.secretKey, ackE));
      helperStaticPub = decryptAndHash(ss, ackS);
      mixKey(ss, dh(ephemeral.secretKey, helperStaticPub));
      mixKey(ss, derivePsk(secret));
      return encryptAndHash(ss, new Uint8Array(0));
    },
    finish(confirmAckD) {
      const token = decodeToken(decryptAndHash(ss, confirmAckD));
      if (helperStaticPub === null) throw new SecureChannelError('bad_handshake');
      const keys = split(ss);
      return { token, helperStaticPub, sendKey: keys.c2s, recvKey: keys.s2c };
    },
  };
}

// Codeless reconnect (NK-shaped): the phone encrypts to the pinned helper static key, so a rotated or
// wrong identity fails to open. No psk - trust comes from the pinned key. The bearer token is then
// sent inside the resulting encrypted channel.
export type ReconnectInitiator = {
  hello(): { e: Uint8Array; d: Uint8Array };
  finish(ackE: Uint8Array, ackD: Uint8Array): RecordKeys;
};

export function createReconnectInitiator(
  ephemeral: KeyPair,
  helperStaticPub: Uint8Array,
): ReconnectInitiator {
  const ss = initSymmetric();
  mixHash(ss, utf8Encode('reconnect'));
  mixHash(ss, helperStaticPub);
  mixHash(ss, ephemeral.publicKey);
  mixKey(ss, dh(ephemeral.secretKey, helperStaticPub));
  return {
    hello() {
      return { e: ephemeral.publicKey, d: encryptAndHash(ss, new Uint8Array(0)) };
    },
    finish(ackE, ackD) {
      mixHash(ss, ackE);
      mixKey(ss, dh(ephemeral.secretKey, ackE));
      decryptAndHash(ss, ackD);
      const keys = split(ss);
      return { sendKey: keys.c2s, recvKey: keys.s2c };
    },
  };
}

export type ReconnectResponder = {
  respond(helloE: Uint8Array, helloD: Uint8Array): { e: Uint8Array; d: Uint8Array } & RecordKeys;
};

export function createReconnectResponder(opts: {
  ephemeral: KeyPair;
  staticKey: KeyPair;
}): ReconnectResponder {
  const ss = initSymmetric();
  mixHash(ss, utf8Encode('reconnect'));
  mixHash(ss, opts.staticKey.publicKey);
  return {
    respond(helloE, helloD) {
      mixHash(ss, helloE);
      mixKey(ss, dh(opts.staticKey.secretKey, helloE));
      decryptAndHash(ss, helloD);
      mixHash(ss, opts.ephemeral.publicKey);
      mixKey(ss, dh(opts.ephemeral.secretKey, helloE));
      const d = encryptAndHash(ss, new Uint8Array(0));
      const keys = split(ss);
      return { e: opts.ephemeral.publicKey, d, sendKey: keys.s2c, recvKey: keys.c2s };
    },
  };
}

// Helper side of pairing. Emits nothing psk-keyed until confirm() has verified the phone's proof.
export type PairResponder = {
  respond(helloE: Uint8Array): { e: Uint8Array; s: Uint8Array };
  confirm(confirmD: Uint8Array): boolean;
  complete(token: string): { confirmAck: Uint8Array } & RecordKeys;
};

export function createPairResponder(opts: {
  ephemeral: KeyPair;
  staticKey: KeyPair;
  secret: Uint8Array;
}): PairResponder {
  const ss = initSymmetric();
  mixHash(ss, utf8Encode('pair'));
  return {
    respond(helloE) {
      mixHash(ss, helloE);
      mixHash(ss, opts.ephemeral.publicKey);
      mixKey(ss, dh(opts.ephemeral.secretKey, helloE));
      const s = encryptAndHash(ss, opts.staticKey.publicKey);
      mixKey(ss, dh(opts.staticKey.secretKey, helloE));
      mixKey(ss, derivePsk(opts.secret));
      return { e: opts.ephemeral.publicKey, s };
    },
    confirm(confirmD) {
      try {
        decryptAndHash(ss, confirmD);
        return true;
      } catch {
        return false;
      }
    },
    complete(token) {
      const confirmAck = encryptAndHash(ss, encodeToken(token));
      const keys = split(ss);
      return { confirmAck, sendKey: keys.s2c, recvKey: keys.c2s };
    },
  };
}
