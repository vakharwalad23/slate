import { execFile } from 'node:child_process';
import type { Command } from '@slate/protocol';

export type CommandResult = { ok: boolean; error?: string };

// Injectable so dispatch logic is testable without spawning processes.
export type Run = (file: string, args: string[]) => Promise<void>;

const defaultRun: Run = (file, args) =>
  new Promise((resolve, reject) => {
    execFile(file, args, (err, _stdout, stderr) => {
      if (err) reject(new Error(stderr.trim() || err.message));
      else resolve();
    });
  });

export async function executeCommand(cmd: Command, run: Run = defaultRun): Promise<CommandResult> {
  switch (cmd.kind) {
    case 'launch_app':
      try {
        await run('open', ['-a', cmd.app]);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    default:
      return { ok: false, error: `not implemented: ${cmd.kind}` };
  }
}
