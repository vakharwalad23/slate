import { CommandSchema } from '@slate/protocol';
import { z } from 'zod';

export const IconRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('appIcon'), bundleId: z.string() }),
  z.object({ kind: z.literal('emoji'), value: z.string() }),
  z.object({ kind: z.literal('glyph'), name: z.string() }),
]);

export const ButtonPositionSchema = z.object({
  col: z.int().nonnegative(),
  row: z.int().nonnegative(),
});

// Persisted now, editor UI deferred.
export const GestureMapSchema = z.object({
  longPress: CommandSchema.optional(),
  doubleTap: CommandSchema.optional(),
});

export const DeckButtonSchema = z.object({
  id: z.uuid(),
  position: ButtonPositionSchema,
  label: z.string().optional(),
  icon: IconRefSchema,
  action: CommandSchema,
  gestures: GestureMapSchema.optional(),
  color: z.string().optional(),
});

export const PageSchema = z.object({
  id: z.uuid(),
  columns: z.int().min(1).max(8),
  rows: z.int().min(1).max(12),
  buttons: z.array(DeckButtonSchema),
});

export const DeckSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  pages: z.array(PageSchema),
});

export type IconRef = z.infer<typeof IconRefSchema>;
export type ButtonPosition = z.infer<typeof ButtonPositionSchema>;
export type DeckButton = z.infer<typeof DeckButtonSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Deck = z.infer<typeof DeckSchema>;
