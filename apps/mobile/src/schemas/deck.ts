import { CommandSchema } from '@slate/protocol';
import { z } from 'zod';

export const IconRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('appIcon'), bundleId: z.string() }),
  z.object({ kind: z.literal('emoji'), value: z.string() }),
  // 'symbol' is a MaterialCommunityIcons glyph; 'glyph' is the lettermark text fallback.
  z.object({ kind: z.literal('symbol'), name: z.string() }),
  z.object({ kind: z.literal('glyph'), name: z.string() }),
]);

export const ButtonPositionSchema = z.object({
  col: z.int().nonnegative(),
  row: z.int().nonnegative(),
});

export const GestureMapSchema = z.object({
  longPress: CommandSchema.optional(),
  doubleTap: CommandSchema.optional(),
  swipeUp: CommandSchema.optional(),
  swipeDown: CommandSchema.optional(),
  swipeLeft: CommandSchema.optional(),
  swipeRight: CommandSchema.optional(),
});

export type GestureSlot = keyof z.infer<typeof GestureMapSchema>;

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
  // Auto-activate this deck when the Mac's frontmost app matches (needs the helper's liveState).
  autoProfile: z.object({ matchBundleId: z.string() }).optional(),
});

export type IconRef = z.infer<typeof IconRefSchema>;
export type ButtonPosition = z.infer<typeof ButtonPositionSchema>;
export type GestureMap = z.infer<typeof GestureMapSchema>;
export type DeckButton = z.infer<typeof DeckButtonSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Deck = z.infer<typeof DeckSchema>;
