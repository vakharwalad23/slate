import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VoiceEndpoint } from './endpoint';
import { VoiceSession } from './session';

function fakeEndpoint() {
  const calls = { start: 0, stop: 0, accept: 0, addIce: 0 };
  let iceCb: ((c: string | null) => void) | null = null;
  const ep: VoiceEndpoint = {
    async start() {
      calls.start++;
    },
    async stop() {
      calls.stop++;
      iceCb = null;
    },
    async acceptOffer() {
      calls.accept++;
      return 'answer-sdp';
    },
    async addIce() {
      calls.addIce++;
    },
    onIce(cb) {
      iceCb = cb;
      return () => {
        iceCb = null;
      };
    },
    onLocalAudio() {
      return () => {};
    },
    onRemoteAudio() {
      return () => {};
    },
  };
  return { ep, calls, emitIce: (c: string | null) => iceCb?.(c) };
}

test('handleOffer starts the endpoint and returns the answer', async () => {
  const { ep, calls } = fakeEndpoint();
  const s = new VoiceSession(() => ep);
  const answer = await s.handleOffer('offer-sdp');
  assert.equal(answer, 'answer-sdp');
  assert.equal(calls.start, 1);
  assert.equal(calls.accept, 1);
  assert.equal(s.isActive(), true);
});

test('onIce forwards endpoint candidates to the subscriber', async () => {
  const { ep, emitIce } = fakeEndpoint();
  const s = new VoiceSession(() => ep);
  const seen: (string | null)[] = [];
  s.onIce((c) => seen.push(c));
  await s.handleOffer('offer-sdp');
  emitIce('cand-1');
  emitIce(null);
  assert.deepEqual(seen, ['cand-1', null]);
});

test('hangup stops the endpoint once and is idempotent', async () => {
  const { ep, calls } = fakeEndpoint();
  const s = new VoiceSession(() => ep);
  await s.handleOffer('offer-sdp');
  await s.hangup();
  await s.hangup();
  assert.equal(calls.stop, 1);
  assert.equal(s.isActive(), false);
});

test('addIce before an active call is a no-op (does not throw)', async () => {
  const { ep, calls } = fakeEndpoint();
  const s = new VoiceSession(() => ep);
  await s.addIce('cand');
  assert.equal(calls.addIce, 0);
});
