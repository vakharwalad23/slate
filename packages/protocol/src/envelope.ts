import { z } from 'zod';

export const PROTOCOL_VERSION = 1 as const;

// Every message shares these fields; specific messages refine `type` and `payload`.
// reId correlates a response to its request id; null on requests.
export const envelopeBase = {
  v: z.literal(PROTOCOL_VERSION),
  id: z.uuid(),
  reId: z.uuid().nullable(),
};

export const EnvelopeSchema = z.object({
  ...envelopeBase,
  type: z.string(),
  payload: z.unknown(),
});

export type Envelope = z.infer<typeof EnvelopeSchema>;
