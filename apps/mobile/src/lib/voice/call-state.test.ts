import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type CallState, initialCallState, voiceReducer } from './call-state';

const at = (s: CallState['status']): CallState => ({ ...initialCallState, status: s });

test('user_start moves idle -> offering with a callId', () => {
  const next = voiceReducer(initialCallState, { type: 'user_start', callId: 'c1' });
  assert.equal(next.status, 'offering');
  assert.equal(next.callId, 'c1');
});

test('answered moves offering -> connecting', () => {
  const next = voiceReducer({ ...at('offering'), callId: 'c1' }, { type: 'answered' });
  assert.equal(next.status, 'connecting');
});

test('ice_connected moves connecting -> in_call', () => {
  assert.equal(voiceReducer(at('connecting'), { type: 'ice_connected' }).status, 'in_call');
});

test('socket_drop from any active status -> ended with reason', () => {
  const next = voiceReducer({ ...at('in_call'), callId: 'c1' }, { type: 'socket_drop' });
  assert.equal(next.status, 'ended');
  assert.equal(next.endReason, 'socket_drop');
});

test('ice_failed from connecting -> ended with ice_failed reason (watchdog)', () => {
  const next = voiceReducer({ ...at('connecting'), callId: 'c1' }, { type: 'ice_failed' });
  assert.equal(next.status, 'ended');
  assert.equal(next.endReason, 'ice_failed');
});

test('ice_failed from offering -> ended with ice_failed reason (watchdog)', () => {
  const next = voiceReducer({ ...at('offering'), callId: 'c1' }, { type: 'ice_failed' });
  assert.equal(next.status, 'ended');
  assert.equal(next.endReason, 'ice_failed');
});

test('reset moves ended -> idle and clears callId', () => {
  const next = voiceReducer(
    { ...at('ended'), callId: 'c1', endReason: 'user_hangup' },
    { type: 'reset' },
  );
  assert.equal(next.status, 'idle');
  assert.equal(next.callId, null);
});

test('stale events for a different callId are ignored', () => {
  const s = { ...at('in_call'), callId: 'c1' } as CallState;
  const next = voiceReducer(s, { type: 'answered', callId: 'OTHER' });
  assert.deepEqual(next, s);
});
