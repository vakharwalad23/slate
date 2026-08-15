import { z } from 'zod';

export const VoiceOfferPayload = z.object({ callId: z.uuid(), sdp: z.string() });
export const VoiceAnswerPayload = z.object({ callId: z.uuid(), sdp: z.string() });
// candidate null = end-of-candidates (trickle ICE terminator).
export const VoiceIcePayload = z.object({ callId: z.uuid(), candidate: z.string().nullable() });
export const VoiceHangupPayload = z.object({ callId: z.uuid(), reason: z.string() });
