import type { MessageOf } from '@slate/protocol';
import { PROTOCOL_VERSION } from '@slate/protocol';

type NewId = () => string;

export function voiceOfferMessage(
  callId: string,
  sdp: string,
  newId: NewId,
): MessageOf<'voice.offer'> {
  return {
    v: PROTOCOL_VERSION,
    id: newId(),
    reId: null,
    type: 'voice.offer',
    payload: { callId, sdp },
  };
}

export function voiceAnswerMessage(
  callId: string,
  sdp: string,
  reId: string,
  newId: NewId,
): MessageOf<'voice.answer'> {
  return { v: PROTOCOL_VERSION, id: newId(), reId, type: 'voice.answer', payload: { callId, sdp } };
}

export function voiceIceMessage(
  callId: string,
  candidate: string | null,
  newId: NewId,
): MessageOf<'voice.ice'> {
  return {
    v: PROTOCOL_VERSION,
    id: newId(),
    reId: null,
    type: 'voice.ice',
    payload: { callId, candidate },
  };
}

export function voiceHangupMessage(
  callId: string,
  reason: string,
  newId: NewId,
): MessageOf<'voice.hangup'> {
  return {
    v: PROTOCOL_VERSION,
    id: newId(),
    reId: null,
    type: 'voice.hangup',
    payload: { callId, reason },
  };
}
