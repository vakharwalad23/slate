import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MessageSchema } from '@slate/protocol';
import { voiceHangupMessage, voiceIceMessage, voiceOfferMessage } from './messages';

const uuid = '22222222-2222-4222-8222-222222222222';

test('voiceOfferMessage builds a schema-valid frame', () => {
  const m = voiceOfferMessage(uuid, 'v=0...', () => uuid);
  assert.equal(MessageSchema.safeParse(m).success, true);
  assert.equal(m.type, 'voice.offer');
  assert.equal(m.reId, null);
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
