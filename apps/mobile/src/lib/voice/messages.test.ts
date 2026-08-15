import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MessageSchema } from '@slate/protocol';
import {
  voiceAnswerMessage,
  voiceHangupMessage,
  voiceIceMessage,
  voiceOfferMessage,
} from './messages';

const uuid = '22222222-2222-4222-8222-222222222222';
const reId = '33333333-3333-4333-8333-333333333333';

test('voiceOfferMessage builds a schema-valid frame', () => {
  const m = voiceOfferMessage(uuid, 'v=0...', () => uuid);
  assert.equal(MessageSchema.safeParse(m).success, true);
  assert.equal(m.type, 'voice.offer');
  assert.equal(m.reId, null);
});

test('voiceAnswerMessage carries the reId and is schema-valid', () => {
  const m = voiceAnswerMessage(uuid, 'v=0...', reId, () => uuid);
  assert.equal(MessageSchema.safeParse(m).success, true);
  assert.equal(m.type, 'voice.answer');
  assert.equal(m.reId, reId);
  assert.equal(m.payload.callId, uuid);
});

test('voiceIceMessage accepts a null candidate (end-of-candidates)', () => {
  const m = voiceIceMessage(uuid, null, () => uuid);
  assert.equal(MessageSchema.safeParse(m).success, true);
  assert.equal(m.payload.candidate, null);
});

test('voiceHangupMessage carries the reason', () => {
  const m = voiceHangupMessage(uuid, 'user_hangup', () => uuid);
  assert.equal(m.payload.reason, 'user_hangup');
});
