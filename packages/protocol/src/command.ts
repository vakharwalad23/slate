import { z } from 'zod';

// Command kinds the helper can execute. Wire field names are load-bearing - mirrored in Protocol.swift.
// Members are single-sourced so the base union (macro steps) and the full union stay in lockstep.
const launchApp = z.object({ kind: z.literal('launch_app'), app: z.string() });
const activateApp = z.object({ kind: z.literal('activate_app'), bundleId: z.string() });
const quitApp = z.object({ kind: z.literal('quit_app'), bundleId: z.string() });
const runShortcut = z.object({
  kind: z.literal('run_shortcut'),
  name: z.string(),
  input: z.string().optional(),
});
const runApplescript = z.object({ kind: z.literal('run_applescript'), script: z.string() });
const runShell = z.object({ kind: z.literal('run_shell'), script: z.string() });
const media = z.object({
  kind: z.literal('media'),
  action: z.enum(['playpause', 'next', 'prev', 'volume_up', 'volume_down', 'mute']),
});
const keystroke = z.object({
  kind: z.literal('keystroke'),
  key: z.string(),
  modifiers: z.array(z.enum(['cmd', 'shift', 'option', 'control'])),
});
const space = z.object({ kind: z.literal('space'), direction: z.enum(['next', 'prev']) });
const appSwitch = z.object({ kind: z.literal('app_switch'), direction: z.enum(['next', 'prev']) });

// Macro steps are base commands only - a macro cannot nest another macro (keeps the type non-recursive).
export const BaseCommandSchema = z.discriminatedUnion('kind', [
  launchApp,
  activateApp,
  quitApp,
  runShortcut,
  runApplescript,
  runShell,
  media,
  keystroke,
  space,
  appSwitch,
]);

const macro = z.object({
  kind: z.literal('macro'),
  steps: z.array(
    z.object({ command: BaseCommandSchema, delayMs: z.int().nonnegative().optional() }),
  ),
});

export const CommandSchema = z.discriminatedUnion('kind', [
  launchApp,
  activateApp,
  quitApp,
  runShortcut,
  runApplescript,
  runShell,
  media,
  keystroke,
  space,
  appSwitch,
  macro,
]);

export type BaseCommand = z.infer<typeof BaseCommandSchema>;
export type Command = z.infer<typeof CommandSchema>;
