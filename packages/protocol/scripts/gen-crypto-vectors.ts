import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromHex, toHex, utf8Encode } from '../src/crypto/bytes';
import {
  createPairInitiator,
  createPairResponder,
  createReconnectInitiator,
  createReconnectResponder,
} from '../src/crypto/handshake';
import {
  aeadSeal,
  derivePsk,
  dh,
  hkdfSha256,
  nonceFromCounter,
  x25519PublicKey,
} from '../src/crypto/primitives';
import { createRecordLayer } from '../src/crypto/record';

// Deterministic cross-language byte contract for the secure channel. Regenerate with
// `pnpm -F @slate/protocol tsx scripts/gen-crypto-vectors.ts`; the TS and Swift vector tests both
// recompute these and assert byte-identity, so drift or a JS<->CryptoKit mismatch fails CI.
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'fixtures', 'crypto-vectors.json');

// RFC 5869 test case 1 inputs; slate cases mirror the split/psk shapes used by the handshake.
const hkdf = [
  {
    name: 'rfc5869-case1',
    ikm: '0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b',
    salt: '000102030405060708090a0b0c',
    info: 'f0f1f2f3f4f5f6f7f8f9',
    length: 42,
  },
  {
    name: 'empty-salt-empty-info',
    ikm: '0102030405060708090a0b0c0d0e0f10',
    salt: '',
    info: '',
    length: 64,
  },
].map((c) => ({
  ...c,
  okm: toHex(hkdfSha256(fromHex(c.ikm), fromHex(c.salt), fromHex(c.info), c.length)),
}));

const psk = [
  { name: 'code-123456', secretUtf8: '123456' },
  {
    name: 'qr-32-bytes',
    secretHex: '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20',
  },
].map((c) => {
  const secret = 'secretUtf8' in c ? utf8Encode(c.secretUtf8) : fromHex(c.secretHex);
  return { name: c.name, secret: toHex(secret), psk: toHex(derivePsk(secret)) };
});

// RFC 8439 section 2.8.2 for the raw AEAD, then slate's 4-zeros||LE64 counter nonces.
const AEAD_KEY = '808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f';
const AEAD_PT = utf8Encode('slate encrypted frame');
const aead = [
  {
    name: 'rfc8439',
    key: AEAD_KEY,
    nonce: '070000004041424344454647',
    aad: '50515253c0c1c2c3c4c5c6c7',
    plaintextHex:
      '4c616469657320616e642047656e746c656d656e206f662074686520636c617373206f66202739393a204966204920636f756c64206f6666657220796f75206f6e6c79206f6e652074697020666f7220746865206675747572652c2073756e73637265656e20776f756c642062652069742e',
  },
].map((c) => ({
  name: c.name,
  key: c.key,
  nonce: c.nonce,
  aad: c.aad,
  plaintext: c.plaintextHex,
  ciphertext: toHex(
    aeadSeal(fromHex(c.key), fromHex(c.nonce), fromHex(c.aad), fromHex(c.plaintextHex)),
  ),
}));

const aeadCounters = [0n, 1n, 0xffffffffn, 0x100000000n].map((counter) => {
  const nonce = nonceFromCounter(counter);
  return {
    name: `counter-${counter.toString()}`,
    key: AEAD_KEY,
    counter: counter.toString(),
    nonce: toHex(nonce),
    aad: '',
    plaintext: toHex(AEAD_PT),
    ciphertext: toHex(aeadSeal(fromHex(AEAD_KEY), nonce, new Uint8Array(0), AEAD_PT)),
  };
});

// RFC 7748 section 5.2 X25519 vector 1, plus a pubkey-derivation check.
const x25519 = [
  {
    name: 'rfc7748-vector1',
    secretKey: 'a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4',
    peerPublicKey: 'e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c',
  },
].map((c) => ({
  name: c.name,
  secretKey: c.secretKey,
  peerPublicKey: c.peerPublicKey,
  publicKey: toHex(x25519PublicKey(fromHex(c.secretKey))),
  shared: toHex(dh(fromHex(c.secretKey), fromHex(c.peerPublicKey))),
}));

const RECORD_SEND_KEY = '0000000000000000000000000000000000000000000000000000000000000001';
const RECORD_RECV_KEY = '0000000000000000000000000000000000000000000000000000000000000002';
const recordMessages = ['first', 'second frame', 'third and last'].map((m) => utf8Encode(m));
const recordLayer = createRecordLayer(fromHex(RECORD_SEND_KEY), fromHex(RECORD_RECV_KEY));
const record = {
  name: 'three-frames',
  sendKey: RECORD_SEND_KEY,
  recvKey: RECORD_RECV_KEY,
  frames: recordMessages.map((plaintext) => ({
    plaintext: toHex(plaintext),
    sealed: toHex(recordLayer.seal(plaintext)),
  })),
};

// Full pair handshake with fixed ephemerals/static/secret/token: exact transcript + record keys.
const HS_EP = '1111111111111111111111111111111111111111111111111111111111111111';
const HS_EH = '2222222222222222222222222222222222222222222222222222222222222222';
const HS_SH = '3333333333333333333333333333333333333333333333333333333333333333';
const HS_SECRET = '4a37c9f1e2b85d06';
const HS_TOKEN = 'tok_pairing_0123456789';

const hsInitiator = createPairInitiator({
  secretKey: fromHex(HS_EP),
  publicKey: x25519PublicKey(fromHex(HS_EP)),
});
const hsResponder = createPairResponder({
  ephemeral: { secretKey: fromHex(HS_EH), publicKey: x25519PublicKey(fromHex(HS_EH)) },
  staticKey: { secretKey: fromHex(HS_SH), publicKey: x25519PublicKey(fromHex(HS_SH)) },
  secret: fromHex(HS_SECRET),
});
const hsHello = hsInitiator.hello();
const hsAck = hsResponder.respond(hsHello);
const hsConfirm = hsInitiator.consumeAck(hsAck.e, hsAck.s, fromHex(HS_SECRET));
if (!hsResponder.confirm(hsConfirm)) throw new Error('handshake vector: confirm failed');
const hsComplete = hsResponder.complete(HS_TOKEN);
const hsResult = hsInitiator.finish(hsComplete.confirmAck);
if (hsResult.token !== HS_TOKEN) throw new Error('handshake vector: token mismatch');

const handshakePair = {
  name: 'pair-fixed',
  ephemeralInitiator: HS_EP,
  ephemeralResponder: HS_EH,
  staticResponder: HS_SH,
  staticResponderPublic: toHex(x25519PublicKey(fromHex(HS_SH))),
  secret: HS_SECRET,
  token: HS_TOKEN,
  hello: toHex(hsHello),
  ackE: toHex(hsAck.e),
  ackS: toHex(hsAck.s),
  confirm: toHex(hsConfirm),
  confirmAck: toHex(hsComplete.confirmAck),
  initiatorSendKey: toHex(hsResult.sendKey),
  initiatorRecvKey: toHex(hsResult.recvKey),
  responderSendKey: toHex(hsComplete.sendKey),
  responderRecvKey: toHex(hsComplete.recvKey),
};

// Codeless reconnect handshake with fixed ephemerals + helper static.
const RC_EP = '5555555555555555555555555555555555555555555555555555555555555555';
const RC_EH = '6666666666666666666666666666666666666666666666666666666666666666';
const RC_SH = '3333333333333333333333333333333333333333333333333333333333333333';
const rcStaticPub = x25519PublicKey(fromHex(RC_SH));
const rcInitiator = createReconnectInitiator(
  { secretKey: fromHex(RC_EP), publicKey: x25519PublicKey(fromHex(RC_EP)) },
  rcStaticPub,
);
const rcResponder = createReconnectResponder({
  ephemeral: { secretKey: fromHex(RC_EH), publicKey: x25519PublicKey(fromHex(RC_EH)) },
  staticKey: { secretKey: fromHex(RC_SH), publicKey: rcStaticPub },
});
const rcHello = rcInitiator.hello();
const rcAck = rcResponder.respond(rcHello.e, rcHello.d);
const rcKeys = rcInitiator.finish(rcAck.e, rcAck.d);
if (
  toHex(rcKeys.sendKey) !== toHex(rcAck.recvKey) ||
  toHex(rcKeys.recvKey) !== toHex(rcAck.sendKey)
) {
  throw new Error('reconnect vector: key directions do not match');
}

const handshakeReconnect = {
  name: 'reconnect-fixed',
  ephemeralInitiator: RC_EP,
  ephemeralResponder: RC_EH,
  staticResponder: RC_SH,
  staticResponderPublic: toHex(rcStaticPub),
  helloE: toHex(rcHello.e),
  helloD: toHex(rcHello.d),
  ackE: toHex(rcAck.e),
  ackD: toHex(rcAck.d),
  initiatorSendKey: toHex(rcKeys.sendKey),
  initiatorRecvKey: toHex(rcKeys.recvKey),
  responderSendKey: toHex(rcAck.sendKey),
  responderRecvKey: toHex(rcAck.recvKey),
};

const vectors = {
  note: 'KNOWN-ANSWER TEST VECTORS ONLY - fixed dummy inputs, never used at runtime (real keys are random per handshake). Generated by scripts/gen-crypto-vectors.ts; TS (noble) and Swift (CryptoKit) tests recompute and assert byte-identity. See docs/security.md.',
  hkdf,
  psk,
  aead: [...aead, ...aeadCounters],
  x25519,
  record,
  handshakePair,
  handshakeReconnect,
};

writeFileSync(out, `${JSON.stringify(vectors, null, 2)}\n`);
process.stdout.write(`wrote ${out}\n`);
