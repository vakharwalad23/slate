import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  fromBase64,
  fromBase64Url,
  fromHex,
  toBase64,
  toBase64Url,
  toHex,
  utf8Decode,
  utf8Encode,
} from './crypto/bytes';
import { SecureChannelError } from './crypto/errors';
import {
  aeadOpen,
  aeadSeal,
  derivePsk,
  dh,
  hkdfSha256,
  nonceFromCounter,
  x25519PublicKey,
} from './crypto/primitives';
import { createRecordLayer } from './crypto/record';

type Vectors = {
  hkdf: { name: string; ikm: string; salt: string; info: string; length: number; okm: string }[];
  psk: { name: string; secret: string; psk: string }[];
  aead: {
    name: string;
    key: string;
    nonce: string;
    aad: string;
    plaintext: string;
    ciphertext: string;
    counter?: string;
  }[];
  x25519: {
    name: string;
    secretKey: string;
    peerPublicKey: string;
    publicKey: string;
    shared: string;
  }[];
  record: {
    name: string;
    sendKey: string;
    recvKey: string;
    frames: { plaintext: string; sealed: string }[];
  };
};

const here = dirname(fileURLToPath(import.meta.url));
const vectors = JSON.parse(
  readFileSync(join(here, '..', 'fixtures', 'crypto-vectors.json'), 'utf8'),
) as Vectors;

for (const v of vectors.hkdf) {
  test(`hkdf ${v.name}`, () => {
    assert.equal(
      toHex(hkdfSha256(fromHex(v.ikm), fromHex(v.salt), fromHex(v.info), v.length)),
      v.okm,
    );
  });
}

for (const v of vectors.psk) {
  test(`derivePsk ${v.name}`, () => {
    assert.equal(toHex(derivePsk(fromHex(v.secret))), v.psk);
  });
}

for (const v of vectors.aead) {
  test(`aead ${v.name}`, () => {
    const key = fromHex(v.key);
    const nonce = fromHex(v.nonce);
    const aad = fromHex(v.aad);
    const plaintext = fromHex(v.plaintext);
    assert.equal(toHex(aeadSeal(key, nonce, aad, plaintext)), v.ciphertext);
    assert.equal(toHex(aeadOpen(key, nonce, aad, fromHex(v.ciphertext))), v.plaintext);
    if (v.counter !== undefined) assert.equal(toHex(nonceFromCounter(BigInt(v.counter))), v.nonce);
  });
}

for (const v of vectors.x25519) {
  test(`x25519 ${v.name}`, () => {
    assert.equal(toHex(x25519PublicKey(fromHex(v.secretKey))), v.publicKey);
    assert.equal(toHex(dh(fromHex(v.secretKey), fromHex(v.peerPublicKey))), v.shared);
  });
}

test('record layer seals to vectors and mirror opens', () => {
  const sealer = createRecordLayer(
    fromHex(vectors.record.sendKey),
    fromHex(vectors.record.recvKey),
  );
  const opener = createRecordLayer(
    fromHex(vectors.record.recvKey),
    fromHex(vectors.record.sendKey),
  );
  for (const frame of vectors.record.frames) {
    const sealed = sealer.seal(fromHex(frame.plaintext));
    assert.equal(toHex(sealed), frame.sealed);
    assert.equal(toHex(opener.open(sealed)), frame.plaintext);
  }
});

test('aead rejects a tampered tag', () => {
  const v = vectors.aead[0];
  assert.ok(v);
  const ct = fromHex(v.ciphertext);
  ct[0] = (ct[0] ?? 0) ^ 1;
  assert.throws(
    () => aeadOpen(fromHex(v.key), fromHex(v.nonce), fromHex(v.aad), ct),
    (e) => e instanceof SecureChannelError && e.code === 'aead_open_failed',
  );
});

test('record open rejects replayed and out-of-order frames', () => {
  const sealer = createRecordLayer(
    fromHex(vectors.record.sendKey),
    fromHex(vectors.record.recvKey),
  );
  const first = sealer.seal(utf8Encode('a'));
  const second = sealer.seal(utf8Encode('b'));

  const inOrder = createRecordLayer(
    fromHex(vectors.record.recvKey),
    fromHex(vectors.record.sendKey),
  );
  assert.deepEqual(inOrder.open(first), utf8Encode('a'));
  // Counter already advanced past 0, so the same frame replayed no longer opens.
  assert.throws(() => inOrder.open(first), SecureChannelError);

  const skipping = createRecordLayer(
    fromHex(vectors.record.recvKey),
    fromHex(vectors.record.sendKey),
  );
  // Frame sealed at counter 1 cannot open while the opener still expects counter 0.
  assert.throws(() => skipping.open(second), SecureChannelError);
});

test('dh rejects an all-zero peer key', () => {
  const scalar = fromHex(vectors.x25519[0]?.secretKey ?? '');
  assert.throws(
    () => dh(scalar, new Uint8Array(32)),
    (e) => e instanceof SecureChannelError && e.code === 'bad_public_key',
  );
});

test('base64 and utf8 codecs round-trip', () => {
  const cases = [
    new Uint8Array(0),
    Uint8Array.from([0]),
    Uint8Array.from([255, 254, 253]),
    fromHex('00010203040506070809f0f1f2f3'),
  ];
  for (const bytes of cases) {
    assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
    assert.deepEqual(fromBase64Url(toBase64Url(bytes)), bytes);
  }
  for (const text of ['', 'ascii', 'slate/psk/v2', 'unicode: caf\u00e9 \u{1f512}']) {
    assert.equal(utf8Decode(utf8Encode(text)), text);
  }
});
