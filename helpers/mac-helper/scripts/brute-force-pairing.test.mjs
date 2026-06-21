// Brute-force regression test for pairing. Run against a FRESHLY launched helper on loopback
// (lockout state is in-memory and resets on relaunch): `node helpers/mac-helper/scripts/brute-force-pairing.test.mjs`.
// Node 24 global WebSocket, zero deps. Proves: the lockout is reached, CANNOT be reset by spamming
// pair_request, and is global across connections.
import { randomUUID } from 'node:crypto';

const URL = 'ws://127.0.0.1:8765';
const WRONG = '000000';
const LOCK_THRESHOLD = 5; // must match the helper's default
const PROTOCOL_VERSION = 1;

let failures = 0;
function check(label, cond) {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`);
  if (!cond) failures += 1;
}

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
        // Resolves the reply correlated to a sent id; null on timeout (e.g. pair_request happy path).
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

const locked = (reply) => reply?.type === 'pair_error' && reply.payload.reason === 'locked';

const main = async () => {
  const a = await connect();
  await a.reply(a.send('hello', { deviceId: randomUUID(), deviceName: 'attacker', appVersion: '0' }));

  // Phase A: reach the lockout with one code and threshold wrong confirms.
  a.send('pair_request', {});
  let last = null;
  for (let i = 0; i < LOCK_THRESHOLD; i += 1) {
    last = await a.reply(a.send('pair_confirm', { code: WRONG }));
  }
  check(`locked after ${LOCK_THRESHOLD} wrong confirms`, locked(last));

  // Phase B: the regression - pair_request must NOT reset the lockout.
  const reqReply = await a.reply(a.send('pair_request', {}));
  check('pair_request during lockout -> pair_error{locked}', locked(reqReply));
  const confirmReply = await a.reply(a.send('pair_confirm', { code: WRONG }));
  check('confirm after pair_request stays locked (not "bad code")', locked(confirmReply));

  // Phase C: lockout is global across connections.
  const b = await connect();
  await b.reply(b.send('hello', { deviceId: randomUUID(), deviceName: 'attacker2', appVersion: '0' }));
  const bReply = await b.reply(b.send('pair_request', {}));
  check('second connection also locked (global)', locked(bReply));

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
