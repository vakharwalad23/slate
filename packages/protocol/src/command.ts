import { z } from 'zod';

// v1 command kinds. v2 adds: keystroke, space, app_switch, media, macro.
export const CommandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('launch_app'), app: z.string() }),
  z.object({ kind: z.literal('activate_app'), bundleId: z.string() }),
  z.object({ kind: z.literal('run_shortcut'), name: z.string(), input: z.string().optional() }),
  z.object({ kind: z.literal('run_applescript'), script: z.string() }),
  z.object({ kind: z.literal('run_shell'), script: z.string() }),
]);

export type Command = z.infer<typeof CommandSchema>;
