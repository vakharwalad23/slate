import { z } from 'zod';

// Command kinds the helper can execute. Wire field names are load-bearing - mirrored in Protocol.swift.
export const CommandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('launch_app'), app: z.string() }),
  z.object({ kind: z.literal('activate_app'), bundleId: z.string() }),
  z.object({ kind: z.literal('quit_app'), bundleId: z.string() }),
  z.object({ kind: z.literal('run_shortcut'), name: z.string(), input: z.string().optional() }),
  z.object({ kind: z.literal('run_applescript'), script: z.string() }),
  z.object({ kind: z.literal('run_shell'), script: z.string() }),
  z.object({
    kind: z.literal('media'),
    action: z.enum(['playpause', 'next', 'prev', 'volume_up', 'volume_down', 'mute']),
  }),
  z.object({
    kind: z.literal('keystroke'),
    key: z.string(),
    modifiers: z.array(z.enum(['cmd', 'shift', 'option', 'control'])),
  }),
  z.object({ kind: z.literal('space'), direction: z.enum(['next', 'prev']) }),
]);

export type Command = z.infer<typeof CommandSchema>;
