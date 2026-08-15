import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MessageOf } from '@slate/protocol';
import { handleMessage } from './dispatch';
import type { VoiceSession } from './voice/session';

const offer: MessageOf<'voice.offer'> = {
  v: 2,
  id: '11111111-1111-4111-8111-111111111111',
  reId: null,
  type: 'voice.offer',
  payload: { callId: '22222222-2222-4222-8222-222222222222', sdp: 'offer-sdp' },
};

test('hello_ack advertises voiceIntercom when a session is present', async () => {
  const res = await handleMessage(
    {
      v: 2,
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      reId: null,
      type: 'hello',
      payload: { deviceId: 'd', deviceName: 'n', appVersion: '1' },
    },
    undefined,
    {} as VoiceSession,
  );
  assert.equal(res?.type, 'hello_ack');
  if (res?.type === 'hello_ack') assert.equal(res.payload.capabilities.voiceIntercom, true);
});

test('voice.offer returns a voice.answer with reId = offer id', async () => {
  const session = { handleOffer: async () => 'answer-sdp', onIce() {} } as unknown as VoiceSession;
  const res = await handleMessage(offer, undefined, session);
  assert.equal(res?.type, 'voice.answer');
  if (res?.type === 'voice.answer') {
    assert.equal(res.reId, offer.id);
    assert.equal(res.payload.callId, offer.payload.callId);
    assert.equal(res.payload.sdp, 'answer-sdp');
  }
});
