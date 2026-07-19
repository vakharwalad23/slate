// Brute-force regression for the v2 pairing. Run against a FRESHLY launched helper on loopback
// (lockout state is in-memory and resets on relaunch):
//   node --import tsx helpers/mac-helper/scripts/brute-force-pairing.test.mjs
// Drives the real X25519 handshake with random WRONG secrets and proves: the 5-strike lockout is
// reached, CANNOT be reset by spamming pair_request, and is global across connections. Node 24 global
// WebSocket; the crypto comes from @slate/protocol so it exercises the exact wire contract.
import { randomBytes, randomUUID } from 'node:crypto';
// Relative import of the protocol crypto source: this standalone script has no package.json to
// resolve the @slate/protocol workspace alias. tsx compiles the .ts on the fly.
import {
  createPairInitiator,
  fromBase64,
  generateKeyPair,
  toBase64,
} from '../../../packages/protocol/src/crypto/index.ts';

const URL = 'ws://127.0.0.1:8765';
const PROTOCOL_VERSION = 2;
const LOCK_THRESHOLD = 5; // must match the helper's default

let failures = 0;
function check(label, cond) {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`);
  if (!cond) failures += 1;
}

const rng = (n) => new Uint8Array(randomBytes(n));

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const waiters = new Map();
    ws.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg?.reId && waiters.has(msg.reId)) {
        const w = waiters.get(msg.reId);
        clearTimeout(w.timer);
        waiters.delete(msg.reId);
        w.resolve(msg);
      }
    });
    ws.addEventListener('error', () => reject(new Error('socket error')));
    ws.addEventListener('open', () =>
      resolve({
        send: (type, payload) => {
          const id = randomUUID();
          ws.send(JSON.stringify({ v: PROTOCOL_VERSION, id, reId: null, type, payload }));
          return id;
        },
        reply: (id, timeoutMs = 1500) =>
          new Promise((res) => {
            const timer = setTimeout(() => {
              waiters.delete(id);
              res(null);
            }, timeoutMs);
            waiters.set(id, { resolve: res, timer });
          }),
        close: () => ws.close(),
      }),
    );
  });
}

// pair_request first so a code is active; its pair_pending push (reId null) is ignored.
async function attemptWrong(conn) {
  conn.send('pair_request', {});
  const initiator = createPairInitiator(generateKeyPair(rng));
  const ack = await conn.reply(conn.send('sec_hello', { mode: 'pair', e: toBase64(initiator.hello()) }));
  if (ack?.type === 'sec_error') return ack.payload.code;
  if (ack?.type !== 'sec_hello_ack') return ack?.type ?? 'none';
  const confirm = initiator.consumeAck(fromBase64(ack.payload.e), fromBase64(ack.payload.s), rng(15));
  const res = await conn.reply(conn.send('sec_confirm', { d: toBase64(confirm) }));
  return res?.type === 'sec_error' ? res.payload.code : (res?.type ?? 'none');
}

const main = async () => {
  const a = await connect();
  await a.reply(a.send('hello', { deviceId: randomUUID(), deviceName: 'attacker', appVersion: '0' }));

  let last = null;
  for (let i = 0; i < LOCK_THRESHOLD; i += 1) last = await attemptWrong(a);
  check(`locked after ${LOCK_THRESHOLD} wrong secrets`, last === 'locked');

  // The core regression: pair_request must NOT reset the lockout.
  const reqReply = await a.reply(a.send('pair_request', {}));
  check(
    'pair_request during lockout -> pair_error{locked}',
    reqReply?.type === 'pair_error' && reqReply.payload.reason === 'locked',
  );
  check('attempt after pair_request stays locked (not bad_code)', (await attemptWrong(a)) === 'locked');

  const b = await connect();
  await b.reply(b.send('hello', { deviceId: randomUUID(), deviceName: 'attacker2', appVersion: '0' }));
  check('second connection also locked (global)', (await attemptWrong(b)) === 'locked');

  a.close();
  b.close();
};

const guard = setTimeout(() => {
  console.error('timed out');
  process.exit(2);
}, 20000);

main()
  .then(() => {
    clearTimeout(guard);
    console.log(failures === 0 ? '\nBRUTE-FORCE TEST PASS' : `\nBRUTE-FORCE TEST FAIL (${failures})`);
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch((e) => {
    clearTimeout(guard);
    console.error('error:', e.message);
    process.exit(2);
  });
